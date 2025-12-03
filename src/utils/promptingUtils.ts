import { logger } from './logger';

export interface RoomAnalysis {
  roomType: 'living_room' | 'bedroom' | 'kitchen' | 'bathroom' | 'dining_room' | 'office' | 'unknown';
  size: 'small' | 'medium' | 'large';
  lighting: 'bright' | 'dim' | 'natural' | 'artificial';
  style: string;
  existingElements: string[];
}

export class PromptingUtils {
  private static getStylePrompts() {
    return {
      modern: process.env.PROMPT_STYLE_MODERN || 'clean lines, minimalist furniture, neutral colors, contemporary design',
      contemporary: process.env.PROMPT_STYLE_CONTEMPORARY || 'sleek furniture, bold accents, modern art, sophisticated color palette',
      traditional: process.env.PROMPT_STYLE_TRADITIONAL || 'classic furniture, warm wood tones, elegant fabrics, timeless design',
      rustic: process.env.PROMPT_STYLE_RUSTIC || 'natural wood furniture, cozy textures, earth tones, farmhouse elements',
      scandinavian: process.env.PROMPT_STYLE_SCANDINAVIAN || 'light wood, white and natural tones, cozy textiles, hygge atmosphere',
      industrial: process.env.PROMPT_STYLE_INDUSTRIAL || 'exposed elements, metal fixtures, raw materials, urban loft aesthetic',
      bohemian: process.env.PROMPT_STYLE_BOHEMIAN || 'eclectic mix, colorful textiles, plants, artistic elements',
      luxury: process.env.PROMPT_STYLE_LUXURY || 'high-end furniture, rich materials, elegant details, sophisticated ambiance'
    };
  }

  // New comprehensive interior design styles for real estate agents
  private static readonly INTERIOR_DESIGN_STYLES = {
    'modern-minimalist': 'Modern minimalist',
    'traditional-elegant': 'Traditional elegant',
    'contemporary-luxury': 'Contemporary luxury',
    'cozy-rustic': 'Cozy rustic',
    'scandinavian': 'Scandinavian',
    'industrial-chic': 'Industrial chic',
    'coastal-calm': 'Coastal calm',
    'bohemian-eclectic': 'Bohemian eclectic',
    'mid-century-modern': 'Mid-century modern',
    'french-country': 'French country',
    'asian-zen': 'Asian zen',
    'mediterranean': 'Mediterranean'
  };

  // Room-specific elements and descriptions
  private static readonly ROOM_SPECIFIC_DETAILS = {
    'living-room': {
      furniture: ['comfortable seating arrangement', 'coffee table', 'area rug', 'decorative pillows'],
      lighting: ['ambient lighting', 'table lamps', 'floor lamps'],
      decor: ['wall art', 'plants', 'throw blankets', 'accent chairs'],
      atmosphere: 'welcoming and social space perfect for entertaining and relaxation'
    },
    'bedroom': {
      furniture: ['bed with quality bedding', 'nightstands', 'dresser', 'comfortable seating'],
      lighting: ['bedside lamps', 'ambient lighting', 'dimmable fixtures'],
      decor: ['decorative pillows', 'window treatments', 'area rug', 'personal touches'],
      atmosphere: 'peaceful and restful sanctuary for sleep and relaxation'
    },
    'kitchen': {
      furniture: ['modern appliances', 'clean countertops', 'stylish backsplash', 'bar stools'],
      lighting: ['pendant lighting', 'under-cabinet lighting', 'natural light'],
      decor: ['decorative bowls', 'fresh flowers', 'herb garden', 'artwork'],
      atmosphere: 'functional and beautiful space perfect for cooking and gathering'
    },
    'bathroom': {
      furniture: ['modern fixtures', 'clean lines', 'storage solutions', 'comfortable seating'],
      lighting: ['vanity lighting', 'ambient lighting', 'natural light'],
      decor: ['fresh towels', 'spa-like accessories', 'plants', 'candles'],
      atmosphere: 'spa-like retreat for relaxation and self-care'
    },
    'dining-room': {
      furniture: ['dining table with chairs', 'sideboard', 'buffet', 'china cabinet'],
      lighting: ['chandelier', 'pendant lighting', 'ambient lighting'],
      decor: ['centerpiece', 'elegant place settings', 'wall art', 'mirrors'],
      atmosphere: 'elegant and sophisticated space for memorable dining experiences'
    },
    'office': {
      furniture: ['desk setup', 'ergonomic chair', 'organized storage', 'bookshelves'],
      lighting: ['task lighting', 'natural light', 'ambient lighting'],
      decor: ['motivational art', 'plants', 'personal items', 'organizational tools'],
      atmosphere: 'productive and inspiring workspace for focus and creativity'
    },
    'garden': {
      furniture: ['outdoor seating', 'garden tables', 'benches', 'hammocks'],
      lighting: ['string lights', 'lanterns', 'path lighting', 'ambient lighting'],
      decor: ['potted plants', 'flower arrangements', 'water features', 'garden art'],
      atmosphere: 'tranquil outdoor oasis for relaxation and nature connection'
    },
    'backyard': {
      furniture: ['patio furniture', 'outdoor dining set', 'loungers', 'fire pit'],
      lighting: ['outdoor lighting', 'string lights', 'path lighting', 'ambient glow'],
      decor: ['landscaping', 'outdoor rugs', 'cushions', 'garden elements'],
      atmosphere: 'versatile outdoor living space perfect for entertainment and relaxation'
    },
    'entryway': {
      furniture: ['console table', 'bench seating', 'coat rack', 'shoe storage'],
      lighting: ['overhead lighting', 'wall sconces', 'natural light'],
      decor: ['mirror', 'artwork', 'plants', 'welcome mat'],
      atmosphere: 'welcoming first impression that sets the tone for the home'
    },
    'basement': {
      furniture: ['comfortable seating', 'entertainment center', 'game tables', 'storage solutions'],
      lighting: ['recessed lighting', 'floor lamps', 'ambient lighting'],
      decor: ['area rugs', 'wall art', 'accent pieces', 'personal touches'],
      atmosphere: 'versatile space perfect for recreation, entertainment, and relaxation'
    }
  };

  private static getRoomSpecificElements() {
    const parseElements = (envVar: string | undefined, defaultElements: string[]): string[] => {
      if (envVar) {
        return envVar.split(',').map(e => e.trim());
      }
      return defaultElements;
    };

    return {
      living_room: parseElements(process.env.PROMPT_ROOM_LIVING_ROOM_ELEMENTS, ['comfortable seating arrangement', 'coffee table', 'area rug', 'ambient lighting', 'decorative pillows', 'wall art', 'plants']),
      bedroom: parseElements(process.env.PROMPT_ROOM_BEDROOM_ELEMENTS, ['bed with quality bedding', 'nightstands', 'table lamps', 'dresser', 'comfortable seating', 'window treatments', 'decorative accents']),
      kitchen: parseElements(process.env.PROMPT_ROOM_KITCHEN_ELEMENTS, ['modern appliances', 'clean countertops', 'stylish backsplash', 'pendant lighting', 'bar stools', 'decorative bowls', 'fresh flowers']),
      bathroom: parseElements(process.env.PROMPT_ROOM_BATHROOM_ELEMENTS, ['fresh towels', 'spa-like accessories', 'plants', 'candles', 'modern fixtures', 'clean lines', 'natural elements']),
      dining_room: parseElements(process.env.PROMPT_ROOM_DINING_ROOM_ELEMENTS, ['dining table with chairs', 'centerpiece', 'pendant or chandelier lighting', 'sideboard', 'wall art', 'elegant place settings']),
      office: parseElements(process.env.PROMPT_ROOM_OFFICE_ELEMENTS, ['desk setup', 'ergonomic chair', 'organized storage', 'task lighting', 'plants', 'motivational art', 'clean workspace'])
    };
  }

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
        return this.enhanceCustomPrompt(customPrompt, style);
      }

      const stylePrompts = this.getStylePrompts();
      const styleDescription = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.modern;
      const roomElementsMap = this.getRoomSpecificElements();
      const roomElements = roomElementsMap[roomType as keyof typeof roomElementsMap] || roomElementsMap.living_room;

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
  static enhanceCustomPrompt(customPrompt: string, style: string): string {
    const enhancementsStr = process.env.PROMPT_ENHANCEMENTS || 'professionally staged, architectural preservation, realistic proportions, perfect lighting, high-end interior photography';
    const enhancements = enhancementsStr.split(',').map(e => e.trim());

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
    const baseNegativesStr = process.env.PROMPT_NEGATIVE_BASE || 'blurry, low quality, distorted, unrealistic proportions, structural changes, architectural modifications, wall removal, ceiling changes, window modifications, door changes, cluttered, messy, oversaturated, artificial looking, poor lighting, dark, grainy, pixelated, furniture floating, impossible perspectives, duplicate objects';
    const baseNegatives = baseNegativesStr.split(',').map(n => n.trim());

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
        prefix: process.env.PROMPT_QUALITY_FAST_PREFIX || 'clean and modern',
        suffix: process.env.PROMPT_QUALITY_FAST_SUFFIX || 'well-lit, professional photo'
      },
      balanced: {
        prefix: process.env.PROMPT_QUALITY_BALANCED_PREFIX || 'professionally staged and designed',
        suffix: process.env.PROMPT_QUALITY_BALANCED_SUFFIX || 'perfect lighting, high-quality interior photography'
      },
      high: {
        prefix: process.env.PROMPT_QUALITY_HIGH_PREFIX || 'expertly designed luxury interior',
        suffix: process.env.PROMPT_QUALITY_HIGH_SUFFIX || 'studio quality lighting, architectural photography, magazine worthy'
      },
      ultra: {
        prefix: process.env.PROMPT_QUALITY_ULTRA_PREFIX || 'award-winning interior design, luxury staging',
        suffix: process.env.PROMPT_QUALITY_ULTRA_SUFFIX || 'professional architectural photography, perfect composition, museum quality, ultra-detailed'
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
    const furniturePrompts: Record<string, string> = {
      sofa: process.env.PROMPT_FURNITURE_PLACEMENT_SOFA || 'comfortable sectional sofa arranged for conversation, proper scale and proportion',
      coffee_table: process.env.PROMPT_FURNITURE_PLACEMENT_COFFEE_TABLE || 'stylish coffee table at appropriate height, centered with seating area',
      dining_table: process.env.PROMPT_FURNITURE_PLACEMENT_DINING_TABLE || 'elegant dining table with matching chairs, proper spacing for movement',
      bed: process.env.PROMPT_FURNITURE_PLACEMENT_BED || 'comfortable bed with quality bedding, proper positioning relative to windows',
      desk: process.env.PROMPT_FURNITURE_PLACEMENT_DESK || 'functional desk setup with ergonomic positioning and proper lighting'
    };

    const basePrompt = furniturePrompts[furnitureType] || 'well-placed furniture';
    return `${basePrompt} in ${roomContext}, realistic proportions, professional staging`;
  }

  /**
   * Get all available interior design styles for the frontend dropdown
   */
  static getInteriorDesignStyles(): { [key: string]: string } {
    return this.INTERIOR_DESIGN_STYLES;
  }

  /**
   * Generate a prompt for a specific interior design style
   */
  static getInteriorDesignPrompt(style: string): string {
    return this.INTERIOR_DESIGN_STYLES[style as keyof typeof this.INTERIOR_DESIGN_STYLES] || 
           this.INTERIOR_DESIGN_STYLES['modern-minimalist'];
  }

  /**
   * Get the display name for a style (for the frontend dropdown)
   */
  static getStyleDisplayName(styleKey: string): string {
    const displayNames: { [key: string]: string } = {
      'modern-minimalist': 'Modern Minimalist',
      'traditional-elegant': 'Traditional Elegant',
      'contemporary-luxury': 'Contemporary Luxury',
      'cozy-rustic': 'Cozy Rustic',
      'scandinavian': 'Scandinavian',
      'industrial-chic': 'Industrial Chic',
      'coastal-calm': 'Coastal Calm',
      'bohemian-eclectic': 'Bohemian Eclectic',
      'mid-century-modern': 'Mid-Century Modern',
      'french-country': 'French Country',
      'asian-zen': 'Asian Zen',
      'mediterranean': 'Mediterranean'
    };
    
    return displayNames[styleKey] || styleKey;
  }

  /**
   * Generate a comprehensive prompt for a specific room type and style
   */
  static generateRoomSpecificPrompt(roomType: string, style: string): string {
    const styleDescription = this.INTERIOR_DESIGN_STYLES[style as keyof typeof this.INTERIOR_DESIGN_STYLES] || this.INTERIOR_DESIGN_STYLES['modern-minimalist'];
    const roomDetails = this.ROOM_SPECIFIC_DETAILS[roomType as keyof typeof this.ROOM_SPECIFIC_DETAILS] || this.ROOM_SPECIFIC_DETAILS['living-room'];

    const prompt = [
      `${styleDescription} ${roomType.replace('-', ' ')}`,
      `with ${roomDetails.furniture.slice(0, 3).join(', ')},`,
      `${roomDetails.lighting.slice(0, 2).join(' and ')},`,
      `${roomDetails.decor.slice(0, 2).join(', ')}.`,
      `The space should feel ${roomDetails.atmosphere}.`,
      'Professionally staged, perfect lighting, high-end photography, realistic proportions.'
    ].join(' ');

    return prompt;
  }

  /**
   * Get all available room types for the frontend dropdown
   */
  static getAvailableRoomTypes(): { [key: string]: string } {
    const roomTypes: { [key: string]: string } = {};
    Object.keys(this.ROOM_SPECIFIC_DETAILS).forEach(key => {
      roomTypes[key] = this.getRoomTypeDisplayName(key);
    });
    return roomTypes;
  }

  /**
   * Get the display name for a room type (for the frontend dropdown)
   */
  static getRoomTypeDisplayName(roomTypeKey: string): string {
    const displayNames: { [key: string]: string } = {
      'living-room': 'Living Room',
      'bedroom': 'Bedroom',
      'kitchen': 'Kitchen',
      'bathroom': 'Bathroom',
      'dining-room': 'Dining Room',
      'office': 'Home Office',
      'garden': 'Garden',
      'backyard': 'Backyard',
      'entryway': 'Entryway',
      'basement': 'Basement'
    };
    
    return displayNames[roomTypeKey] || roomTypeKey.replace('-', ' ');
  }
} 