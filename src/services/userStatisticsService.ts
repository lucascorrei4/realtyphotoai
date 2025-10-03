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
  prompt?: string;
  error_message?: string;
  processing_time_ms?: number;
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
   * Get user generation statistics
   */
  async getUserGenerationStats(userId: string): Promise<GenerationStats> {
    try {
      // Get all generations for the user
      const { data: generations, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user generations:', error);
        throw new Error('Failed to fetch user generations');
      }

      const userGenerations = generations || [];

      // Calculate statistics
      const totalRequests = userGenerations.length;
      const completed = userGenerations.filter(g => g.status === 'completed').length;
      const processing = userGenerations.filter(g => g.status === 'processing').length;
      const failed = userGenerations.filter(g => g.status === 'failed').length;
      const successRate = totalRequests > 0 ? Math.round((completed / totalRequests) * 100) : 0;

      // Count by model type
      const generationsByType = {
        interiorDesign: userGenerations.filter(g => g.model_type === 'interior_design').length,
        imageEnhancement: userGenerations.filter(g => g.model_type === 'image_enhancement').length,
        replaceElements: userGenerations.filter(g => g.model_type === 'element_replacement').length,
        addFurnitures: userGenerations.filter(g => g.model_type === 'add_furnitures').length,
        exteriorDesign: userGenerations.filter(g => g.model_type === 'exterior_design').length,
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
   */
  async getUserGenerationsWithPagination(
    userId: string, 
    page: number = 1, 
    limit: number = 10, 
    filters: GenerationFilters = {}
  ): Promise<PaginatedGenerationsResult> {
    try {
      let query = supabase
        .from('generations')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
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

      const { data: generations, error, count } = await query;

      if (error) {
        logger.error('Error fetching user generations with pagination:', error);
        throw new Error('Failed to fetch user generations');
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        generations: generations || [],
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
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching user generations by type:', error);
        throw new Error('Failed to fetch user generations');
      }

      return generations || [];
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
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching recent user generations by type (getRecentUserGenerations):', error);
        throw new Error('Failed to fetch recent generations by type (getRecentUserGenerations)');
      }

      return generations || [];
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
        logger.error('Error creating generation record:', error);
        throw new Error('Failed to create generation record');
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
}
