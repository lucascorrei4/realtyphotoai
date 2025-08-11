import { logger } from './logger';

export interface RoomAnalysis {
  roomType: 'living_room' | 'bedroom' | 'kitchen' | 'bathroom' | 'dining_room' | 'office' | 'unknown';
  size: 'small' | 'medium' | 'large';
  lighting: 'bright' | 'dim' | 'natural' | 'artificial';
  style: string;
  existingElements: string[];
}

export class PromptingUtils {
  private static readonly STYLE_PROMPTS = {
    modern: 'clean lines, minimalist furniture, neutral colors, contemporary design',
    contemporary: 'sleek furniture, bold accents, modern art, sophisticated color palette',
    traditional: 'classic furniture, warm wood tones, elegant fabrics, timeless design',
    rustic: 'natural wood furniture, cozy textures, earth tones, farmhouse elements',
    scandinavian: 'light wood, white and natural tones, cozy textiles, hygge atmosphere',
    industrial: 'exposed elements, metal fixtures, raw materials, urban loft aesthetic',
    bohemian: 'eclectic mix, colorful textiles, plants, artistic elements',
    luxury: 'high-end furniture, rich materials, elegant details, sophisticated ambiance'
  };

  private static readonly ROOM_SPECIFIC_ELEMENTS = {
    living_room: ['comfortable seating arrangement', 'coffee table', 'area rug', 'ambient lighting', 'decorative pillows', 'wall art', 'plants'],
    bedroom: ['bed with quality bedding', 'nightstands', 'table lamps', 'dresser', 'comfortable seating', 'window treatments', 'decorative accents'],
    kitchen: ['modern appliances', 'clean countertops', 'stylish backsplash', 'pendant lighting', 'bar stools', 'decorative bowls', 'fresh flowers'],
    bathroom: ['fresh towels', 'spa-like accessories', 'plants', 'candles', 'modern fixtures', 'clean lines', 'natural elements'],
    dining_room: ['dining table with chairs', 'centerpiece', 'pendant or chandelier lighting', 'sideboard', 'wall art', 'elegant place settings'],
    office: ['desk setup', 'ergonomic chair', 'organized storage', 'task lighting', 'plants', 'motivational art', 'clean workspace']
  };

  /**
   * Generate an optimized prompt for interior design based on room analysis
   */
  static generateInteriorDesignPrompt(
    style: string = 'modern',
    roomType: string = 'living_room',
    customPrompt?: string
  ): string {
    try {
      if (customPrompt) {
        return this.enhanceCustomPrompt(customPrompt, style, roomType);
      }

      const styleDescription = this.STYLE_PROMPTS[style as keyof typeof this.STYLE_PROMPTS] || this.STYLE_PROMPTS.modern;
      const roomElements = this.ROOM_SPECIFIC_ELEMENTS[roomType as keyof typeof this.ROOM_SPECIFIC_ELEMENTS] || this.ROOM_SPECIFIC_ELEMENTS.living_room;

      const prompt = [
        'professionally staged',
        style,
        roomType.replace('_', ' '),
        'interior design,',
        styleDescription + ',',
        roomElements.slice(0, 4).join(', '), // Use first 4 elements to avoid overly long prompts
        ', perfect lighting, high-end photography, architectural preservation, realistic proportions, no structural changes'
      ].join(' ');

      logger.debug('Generated interior design prompt', { style, roomType, prompt });
      return prompt;

    } catch (error) {
      logger.error('Failed to generate interior design prompt', { error, style, roomType });
      return 'professionally staged modern living room interior with stylish furniture and perfect lighting';
    }
  }

  /**
   * Enhance a custom prompt with interior design best practices
   */
  static enhanceCustomPrompt(customPrompt: string, style: string, _roomType?: string): string {
    const enhancements = [
      'professionally staged',
      'architectural preservation',
      'realistic proportions',
      'perfect lighting',
      'high-end interior photography'
    ];

    // Check if the prompt already contains professional terminology
    const hasEnhancements = enhancements.some(enhancement => 
      customPrompt.toLowerCase().includes(enhancement.toLowerCase())
    );

    if (hasEnhancements) {
      return customPrompt;
    }

    return `professionally staged ${customPrompt}, ${style} style, perfect lighting, architectural preservation, no structural changes`;
  }

  /**
   * Generate negative prompt to avoid common issues in interior design AI
   */
  static generateNegativePrompt(customNegative?: string): string {
    const baseNegatives = [
      'blurry', 'low quality', 'distorted', 'unrealistic proportions',
      'structural changes', 'architectural modifications', 'wall removal',
      'ceiling changes', 'window modifications', 'door changes',
      'cluttered', 'messy', 'oversaturated', 'artificial looking',
      'poor lighting', 'dark', 'grainy', 'pixelated',
      'furniture floating', 'impossible perspectives', 'duplicate objects'
    ];

    if (customNegative) {
      // Combine custom negative with base negatives, avoiding duplicates
      const customTerms = customNegative.split(',').map(term => term.trim().toLowerCase());
      const additionalNegatives = baseNegatives.filter(negative => 
        !customTerms.includes(negative.toLowerCase())
      );
      
      return [customNegative, ...additionalNegatives.slice(0, 5)].join(', ');
    }

    return baseNegatives.join(', ');
  }

  /**
   * Generate prompts for different quality levels
   */
  static getQualityPrompt(quality: 'fast' | 'balanced' | 'high' | 'ultra'): { prefix: string; suffix: string } {
    const qualityPrompts = {
      fast: {
        prefix: 'clean and modern',
        suffix: 'well-lit, professional photo'
      },
      balanced: {
        prefix: 'professionally staged and designed',
        suffix: 'perfect lighting, high-quality interior photography'
      },
      high: {
        prefix: 'expertly designed luxury interior',
        suffix: 'studio quality lighting, architectural photography, magazine worthy'
      },
      ultra: {
        prefix: 'award-winning interior design, luxury staging',
        suffix: 'professional architectural photography, perfect composition, museum quality, ultra-detailed'
      }
    };

    return qualityPrompts[quality] || qualityPrompts.balanced;
  }

  /**
   * Analyze room characteristics from image metadata or description
   * This is a simplified version - in production, you'd use computer vision
   */
  static analyzeRoom(description?: string): RoomAnalysis {
    // Basic analysis based on keywords
    const lowerDesc = description?.toLowerCase() || '';
    
    let roomType: RoomAnalysis['roomType'] = 'unknown';
    if (lowerDesc.includes('living') || lowerDesc.includes('lounge')) roomType = 'living_room';
    else if (lowerDesc.includes('bedroom') || lowerDesc.includes('bed')) roomType = 'bedroom';
    else if (lowerDesc.includes('kitchen')) roomType = 'kitchen';
    else if (lowerDesc.includes('bathroom') || lowerDesc.includes('bath')) roomType = 'bathroom';
    else if (lowerDesc.includes('dining')) roomType = 'dining_room';
    else if (lowerDesc.includes('office') || lowerDesc.includes('study')) roomType = 'office';
    else roomType = 'living_room'; // Default assumption

    const size: RoomAnalysis['size'] = lowerDesc.includes('large') ? 'large' : 
                                      lowerDesc.includes('small') ? 'small' : 'medium';

    const lighting: RoomAnalysis['lighting'] = lowerDesc.includes('bright') ? 'bright' :
                                               lowerDesc.includes('dark') || lowerDesc.includes('dim') ? 'dim' :
                                               lowerDesc.includes('natural') ? 'natural' : 'artificial';

    return {
      roomType,
      size,
      lighting,
      style: 'modern', // Default
      existingElements: []
    };
  }

  /**
   * Generate prompts for specific furniture placement scenarios
   */
  static getFurniturePlacementPrompt(furnitureType: string, roomContext: string): string {
    const furniturePrompts = {
      sofa: 'comfortable sectional sofa arranged for conversation, proper scale and proportion',
      'coffee_table': 'stylish coffee table at appropriate height, centered with seating area',
      'dining_table': 'elegant dining table with matching chairs, proper spacing for movement',
      bed: 'comfortable bed with quality bedding, proper positioning relative to windows',
      desk: 'functional desk setup with ergonomic positioning and proper lighting'
    };

    const basePrompt = furniturePrompts[furnitureType as keyof typeof furniturePrompts] || 'well-placed furniture';
    return `${basePrompt} in ${roomContext}, realistic proportions, professional staging`;
  }
} 