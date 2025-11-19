import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface GenerationStats {
  totalRequests: number;
  completed: number;
  processing: number;
  failed: number;
  successRate: number;
  generationsByType: {
    interiorDesign: number;
    imageEnhancement: number;
    replaceElements: number;
    addFurnitures: number;
    exteriorDesign: number;
  };
}

export interface UserGeneration {
  id: string;
  model_type: string;
  status: string;
  created_at: string;
  input_image_url?: string;
  output_image_url?: string;
  output_video_url?: string;
  prompt?: string;
  error_message?: string;
  processing_time_ms?: number;
  is_deleted?: boolean;
}

export interface PaginatedGenerationsResult {
  generations: UserGeneration[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}

export interface GenerationFilters {
  modelType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class UserStatisticsService {
  /**
   * Check if a URL is a localhost URL (should be filtered out)
   */
  private isLocalhostUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        (hostname.startsWith('172.') && 
         parseInt(hostname.split('.')[1] || '0') >= 16 &&
         parseInt(hostname.split('.')[1] || '0') <= 31)
      );
    } catch {
      // If URL parsing fails, check if it contains localhost strings
      return url.includes('localhost') || url.includes('127.0.0.1');
    }
  }

  /**
   * Filter out generations with localhost URLs and soft-deleted items
   * @param generations - Array of generations to filter
   * @param includeDeleted - If true, includes soft-deleted generations (for statistics). Default: false
   */
  private filterGenerations(generations: UserGeneration[], includeDeleted: boolean = false): UserGeneration[] {
    return generations.filter(gen => {
      // Filter out soft-deleted generations (unless explicitly included for stats)
      if (!includeDeleted && gen.is_deleted === true) {
        return false;
      }
      
      // Filter out generations with localhost URLs in output
      // Only keep R2/public URLs
      const hasLocalhostOutput = this.isLocalhostUrl(gen.output_image_url) || 
                                  this.isLocalhostUrl(gen.output_video_url);
      
      // If output is localhost, exclude it (we only want R2 outputs)
      if (hasLocalhostOutput) {
        return false; // Always exclude if output is localhost
      }
      
      return true;
    });
  }

  /**
   * Get user generation statistics
   * NOTE: Statistics include ALL generations (including soft-deleted) for accurate totals
   * Only localhost URLs are filtered out
   */
  async getUserGenerationStats(userId: string): Promise<GenerationStats> {
    try {
      // Get ALL generations for the user (including soft-deleted) for statistics
      // This ensures total counts are accurate and not affected by soft-delete flag
      const { data: generations, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user generations:', error);
        throw new Error('Failed to fetch user generations');
      }

      // Filter out localhost URLs - only keep R2 uploaded photos
      // Include soft-deleted for statistics (includeDeleted = true)
      const userGenerations = this.filterGenerations(generations || [], true);

      // Calculate statistics (includes soft-deleted generations)
      const totalRequests = userGenerations.length;
      const completed = userGenerations.filter(g => g.status === 'completed').length;
      const processing = userGenerations.filter(g => g.status === 'processing').length;
      const failed = userGenerations.filter(g => g.status === 'failed').length;
      const successRate = totalRequests > 0 ? Math.round((completed / totalRequests) * 100) : 0;

      // Count by model type (includes soft-deleted)
      const generationsByType = {
        interiorDesign: userGenerations.filter(g => g.model_type === 'interior_design').length,
        imageEnhancement: userGenerations.filter(g => g.model_type === 'image_enhancement').length,
        replaceElements: userGenerations.filter(g => g.model_type === 'element_replacement').length,
        addFurnitures: userGenerations.filter(g => g.model_type === 'add_furnitures').length,
        exteriorDesign: userGenerations.filter(g => g.model_type === 'exterior_design').length,
        smartEffects: userGenerations.filter(g => g.model_type === 'smart_effects').length,
      };

      return {
        totalRequests,
        completed,
        processing,
        failed,
        successRate,
        generationsByType
      };
    } catch (error) {
      logger.error('Error in getUserGenerationStats:', error as Error);
      throw error;
    }
  }

  /**
   * Get user generations with pagination and filtering
   * For smart_effects, also includes related video generations
   */
  /**
   * Helper function to fetch related video generations for image model types
   */
  private async fetchRelatedVideoGenerations(
    userId: string,
    outputImageUrls: string[],
    filters: GenerationFilters
  ): Promise<UserGeneration[]> {
    if (outputImageUrls.length === 0) {
      return [];
    }

    try {
      // Query all video generations that use any of these output URLs as input
      // Execute queries in parallel for better performance
      // Query for both video types separately (Supabase .in() may not work well with enums)
      const videoPromises: Promise<any>[] = [];
      
      for (const outputUrl of outputImageUrls) {
        // Query for video_veo3_fast
        const veo3Promise = (async () => {
          try {
            let query = supabase
              .from('generations')
              .select('*')
              .eq('user_id', userId)
              .eq('input_image_url', outputUrl)
              .eq('model_type', 'video_veo3_fast')
              .eq('is_deleted', false); // Only get non-deleted generations

            if (filters.status && filters.status !== 'all') {
              query = query.eq('status', filters.status);
            }
            if (filters.dateFrom) {
              query = query.gte('created_at', filters.dateFrom);
            }
            if (filters.dateTo) {
              const endDate = new Date(filters.dateTo);
              endDate.setDate(endDate.getDate() + 1);
              query = query.lt('created_at', endDate.toISOString());
            }

            return await query;
          } catch (err) {
            logger.warn('Error querying video_veo3_fast:', { outputUrl, error: err });
            return { data: null, error: err };
          }
        })();

        videoPromises.push(veo3Promise);
      }

      // Execute all video queries in parallel
      const videoResults = await Promise.all(videoPromises);

      // Merge all video results, avoiding duplicates
      const videoMap = new Map<string, UserGeneration>();
      for (const result of videoResults) {
        if (result.error) {
          logger.warn('Error fetching video generations:', result.error);
          continue;
        }
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          for (const video of result.data) {
            if (video && video.id && !videoMap.has(video.id)) {
              videoMap.set(video.id, video);
            }
          }
        }
      }

      return Array.from(videoMap.values());
    } catch (error) {
      logger.error('Error fetching video generations:', error as Error);
      // Return empty array - don't fail the entire request
      return [];
    }
  }

  /**
   * Get user generations with pagination and filtering
   * Includes related video generations for image model types
   */
  async getUserGenerationsWithPagination(
    userId: string, 
    page: number = 1, 
    limit: number = 10, 
    filters: GenerationFilters = {}
  ): Promise<PaginatedGenerationsResult> {
    try {
      // Image model types that can have related video generations
      const imageModelTypes = [
        'smart_effects',
        'interior_design',
        'exterior_design',
        'image_enhancement',
        'element_replacement',
        'add_furnitures'
      ];

      // Special handling for image model types: include related video generations
      if (filters.modelType && imageModelTypes.includes(filters.modelType)) {
        // Fetch image generations first (excluding soft-deleted)
        let imageQuery = supabase
          .from('generations')
          .select('*')
          .eq('user_id', userId)
          .eq('model_type', filters.modelType)
          .eq('is_deleted', false); // Only get non-deleted generations

        if (filters.status && filters.status !== 'all') {
          imageQuery = imageQuery.eq('status', filters.status);
        }

        if (filters.dateFrom) {
          imageQuery = imageQuery.gte('created_at', filters.dateFrom);
        }

        if (filters.dateTo) {
          const endDate = new Date(filters.dateTo);
          endDate.setDate(endDate.getDate() + 1);
          imageQuery = imageQuery.lt('created_at', endDate.toISOString());
        }

        const { data: imageResults, error: imageError } = await imageQuery;

        if (imageError) {
          logger.error(`Error fetching ${filters.modelType} generations:`, imageError);
          throw new Error(`Failed to fetch ${filters.modelType} generations`);
        }

        // Extract output_image_urls from image generations
        const outputImageUrls = (imageResults || [])
          .map(g => g.output_image_url)
          .filter((url): url is string => !!url);

        // Fetch related video generations if we have output URLs
        let allGenerations = [...(imageResults || [])];

        if (outputImageUrls.length > 0) {
          const relatedVideos = await this.fetchRelatedVideoGenerations(
            userId,
            outputImageUrls,
            filters
          );

          // Add unique videos to allGenerations
          for (const video of relatedVideos) {
            if (!allGenerations.find(g => g.id === video.id)) {
              allGenerations.push(video);
            }
          }
        }

        // Filter out localhost URLs - only keep R2 uploaded photos
        allGenerations = this.filterGenerations(allGenerations);

        // Sort by created_at descending
        allGenerations.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });

        // Apply pagination manually
        const totalCount = allGenerations.length;
        const totalPages = Math.ceil(totalCount / limit);
        const offset = (page - 1) * limit;
        const paginatedGenerations = allGenerations.slice(offset, offset + limit);

        return {
          generations: paginatedGenerations,
          totalCount,
          totalPages,
          currentPage: page,
          itemsPerPage: limit
        };
      }

      // Standard filtering for other model types (excluding soft-deleted)
      let query = supabase
        .from('generations')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_deleted', false) // Only get non-deleted generations
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.modelType && filters.modelType !== 'all') {
        query = query.eq('model_type', filters.modelType);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        // Add one day to include the end date
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('created_at', endDate.toISOString());
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: generations, error } = await query;

      if (error) {
        logger.error('Error fetching user generations with pagination:', error);
        throw new Error('Failed to fetch user generations');
      }

      // Filter out localhost URLs - only keep R2 uploaded photos
      const filteredGenerations = this.filterGenerations(generations || []);
      
      // Recalculate count after filtering
      const totalCount = filteredGenerations.length;
      const totalPages = Math.ceil(totalCount / limit);
      
      // Apply pagination to filtered results
      const filteredOffset = (page - 1) * limit;
      const paginatedGenerations = filteredGenerations.slice(filteredOffset, filteredOffset + limit);

      return {
        generations: paginatedGenerations,
        totalCount,
        totalPages,
        currentPage: page,
        itemsPerPage: limit
      };
    } catch (error) {
      logger.error('Error in getUserGenerationsWithPagination:', error as Error);
      throw error;
    }
  }

  /**
   * Get user generations by model type
   */
  async getUserGenerationsByType(userId: string, modelType: string, limit: number = 50): Promise<UserGeneration[]> {
    try {
      const { data: generations, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .eq('model_type', modelType)
        .eq('is_deleted', false) // Only get non-deleted generations
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching user generations by type:', error);
        throw new Error('Failed to fetch user generations');
      }

      // Filter out localhost URLs - only keep R2 uploaded photos
      return this.filterGenerations(generations || []);
    } catch (error) {
      logger.error('Error in getUserGenerationsByType:', error as Error);
      throw error;
    }
  }

  /**
   * Get recent user generations (all types)
   */
  async getRecentUserGenerations(userId: string, limit: number = 20): Promise<UserGeneration[]> {
    try {
      const { data: generations, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false) // Only get non-deleted generations
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching recent user generations by type (getRecentUserGenerations):', error);
        throw new Error('Failed to fetch recent generations by type (getRecentUserGenerations)');
      }

      // Filter out localhost URLs - only keep R2 uploaded photos
      return this.filterGenerations(generations || []);
    } catch (error) {
      logger.error('Error in getRecentUserGenerations (getUserGenerationsByType):', error as Error);
      throw error;
    }
  }

  /**
   * Create a new generation record
   */
  async createGenerationRecord(generationData: {
    user_id: string;
    model_type: string;
    status: string;
    input_image_url?: string;
    prompt?: string;
  }): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('generations')
        .insert([{
          ...generationData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (error) {
        logger.error('Error creating generation record:', {
          error: error,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
          errorCode: error.code,
          generationData
        });
        throw new Error(`Failed to create generation record: ${error.message || 'Unknown error'}`);
      }

      return data.id;
    } catch (error) {
      logger.error('Error in createGenerationRecord:', error as Error);
      throw error;
    }
  }

  /**
   * Update generation status
   */
  async updateGenerationStatus(generationId: string, status: string, outputImageUrl?: string, errorMessage?: string, processingTimeMs?: number): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (outputImageUrl) {
        updateData.output_image_url = outputImageUrl;
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      if (processingTimeMs) {
        updateData.processing_time_ms = processingTimeMs;
      }

      const { error } = await supabase
        .from('generations')
        .update(updateData)
        .eq('id', generationId);

      if (error) {
        logger.error('Error updating generation status:', error);
        throw new Error('Failed to update generation status');
      }
    } catch (error) {
      logger.error('Error in updateGenerationStatus:', error as Error);
      throw error;
    }
  }

  /**
   * Soft delete a generation (set is_deleted = true)
   */
  async softDeleteGeneration(generationId: string, userId: string): Promise<void> {
    try {
      // Verify the generation belongs to the user
      const { data: generation, error: fetchError } = await supabase
        .from('generations')
        .select('id, user_id')
        .eq('id', generationId)
        .single();

      if (fetchError || !generation) {
        throw new Error('Generation not found');
      }

      if (generation.user_id !== userId) {
        throw new Error('Unauthorized: Generation does not belong to user');
      }

      // Soft delete the generation
      const { error: updateError } = await supabase
        .from('generations')
        .update({ 
          is_deleted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      if (updateError) {
        logger.error('Error soft deleting generation:', updateError);
        throw new Error(`Failed to delete generation: ${updateError.message}`);
      }

      logger.info('Generation soft deleted successfully', { generationId, userId });
    } catch (error) {
      logger.error('Error in softDeleteGeneration:', error as Error);
      throw error;
    }
  }
}
