#!/usr/bin/env python3
"""
Gerador de Imagens Melhoradas - RealtyProtoAI
Gera visualizações das melhorias sugeridas usando Stable Diffusion
"""

import torch
from diffusers import StableDiffusionPipeline
from PIL import Image, ImageDraw, ImageFont
import os
from datetime import datetime

class RealtyImageGenerator:
    """Gerador de imagens melhoradas para imóveis"""
    
    def __init__(self):
        """Inicializar o pipeline de geração de imagens"""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"🚀 Inicializando gerador de imagens no dispositivo: {self.device}")
        
        # Carregar modelo Stable Diffusion
        model_id = "runwayml/stable-diffusion-v1-5"
        self.pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            use_safetensors=True
        )
        self.pipe = self.pipe.to(self.device)
        
        # Otimizações para melhor performance
        if torch.cuda.is_available():
            self.pipe.enable_model_cpu_offload()
            self.pipe.enable_xformers_memory_efficient_attention()
        
        print("✅ Gerador de imagens carregado com sucesso!")
    
    def generate_improved_room(self, room_description: str, style: str = "modern", 
                              width: int = 768, height: int = 768) -> str:
        """
        Gera uma imagem melhorada baseada na descrição
        
        Args:
            room_description: Descrição do ambiente
            style: Estilo desejado
            width: Largura da imagem
            height: Altura da imagem
            
        Returns:
            Caminho para a imagem gerada
        """
        
        # Criar prompt detalhado
        prompt = self._create_detailed_prompt(room_description, style)
        negative_prompt = self._create_negative_prompt()
        
        print(f"🎨 Gerando imagem com prompt: {prompt[:100]}...")
        
        # Gerar imagem
        with torch.autocast(self.device.type):
            image = self.pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_inference_steps=50,
                guidance_scale=7.5,
                num_images_per_prompt=1
            ).images[0]
        
        # Salvar imagem
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"improved_room_{timestamp}.png"
        filepath = os.path.join("/workspace", filename)
        
        image.save(filepath, quality=95)
        print(f"✅ Imagem salva em: {filepath}")
        
        return filepath
    
    def _create_detailed_prompt(self, description: str, style: str) -> str:
        """Criar prompt detalhado para geração de imagem"""
        
        base_prompt = f"""
        A beautiful, professionally designed {style} living room interior, 
        high-end residential space, architectural photography, 
        {description.lower()},
        natural lighting, warm ambiance, inviting atmosphere,
        professional interior design, luxury home decor,
        clean and organized space, photorealistic, 8K resolution,
        architectural digest style, perfect composition,
        elegant furniture arrangement, sophisticated color palette
        """
        
        # Adicionar elementos específicos baseados no estilo
        style_elements = {
            "modern": "sleek lines, minimalist design, contemporary furniture, neutral colors, glass and steel elements",
            "contemporary": "current trends, stylish furniture, bold accents, mixed textures, sophisticated lighting",
            "traditional": "classic furniture, warm wood tones, elegant fabrics, timeless design, refined details",
            "rustic": "natural materials, wood beams, cozy textures, earthy colors, vintage elements"
        }
        
        if style.lower() in style_elements:
            base_prompt += f", {style_elements[style.lower()]}"
        
        return base_prompt.strip().replace("\n", " ").replace("  ", " ")
    
    def _create_negative_prompt(self) -> str:
        """Criar prompt negativo para evitar elementos indesejados"""
        return """
        blurry, low quality, pixelated, distorted, cluttered, messy, 
        personal items, family photos, dirty, worn out, damaged furniture,
        poor lighting, dark, gloomy, unprofessional, amateur photography,
        watermarks, text, signatures, people, pets, food items,
        laundry, dishes, trash, cables, wires
        """.strip().replace("\n", " ").replace("  ", " ")

def generate_room_improvement():
    """Função principal para gerar melhoria da sala"""
    
    print("🏡 RealtyProtoAI - Gerador de Imagens Melhoradas")
    print("=" * 60)
    
    # Descrição baseada na análise anterior
    room_description = """
    Spacious open concept living room with kitchen island,
    hardwood laminate flooring, white walls, fireplace with wooden accent wall,
    black ceiling fan, pendant lights, large windows overlooking pool area,
    furnished with modern sectional sofa in neutral tones,
    accent chairs in complementary colors, glass coffee table,
    area rug defining seating area, floor lamp for ambient lighting,
    wall art and decorative objects, plants in corners,
    window treatments for privacy and light control
    """
    
    try:
        # Inicializar gerador
        generator = RealtyImageGenerator()
        
        # Gerar imagem melhorada
        image_path = generator.generate_improved_room(
            room_description=room_description,
            style="modern",
            width=768,
            height=768
        )
        
        print(f"\n🎉 IMAGEM GERADA COM SUCESSO!")
        print(f"📁 Localização: {image_path}")
        print(f"🔗 Para baixar: http://localhost:8000/{os.path.basename(image_path)}")
        
        return image_path
        
    except Exception as e:
        print(f"❌ Erro ao gerar imagem: {str(e)}")
        return None

if __name__ == "__main__":
    generate_room_improvement()