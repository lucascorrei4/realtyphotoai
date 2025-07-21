#!/usr/bin/env python3
"""
Teste rápido do RealtyProtoAI
"""

from real_estate_agent import RealEstateGraphicDesigner
import sys

def quick_test(image_path):
    print("🤖 Carregando RealtyProtoAI...")
    agent = RealEstateGraphicDesigner()
    
    print(f"🔍 Processando: {image_path}")
    result = agent.process_image(image_path)
    
    print("\n🏠 RESULTADO:")
    print(f"📝 {result}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        quick_test(sys.argv[1])
    else:
        print("Uso: python quick_test.py <imagem>")