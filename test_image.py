#!/usr/bin/env python3
"""
Script de teste para o RealtyProtoAI
Processa uma imagem e retorna sugestões de melhorias
"""

import sys
import os
from PIL import Image
from real_estate_agent import RealEstateGraphicDesigner

def test_image(image_path):
    """Testa uma imagem com o agente de design"""
    
    # Verificar se o arquivo existe
    if not os.path.exists(image_path):
        print(f"❌ Erro: Arquivo '{image_path}' não encontrado.")
        return
    
    # Verificar se é uma imagem válida
    try:
        with Image.open(image_path) as img:
            print(f"📸 Imagem carregada: {img.size[0]}x{img.size[1]} pixels")
            print(f"🎨 Formato: {img.format}")
    except Exception as e:
        print(f"❌ Erro: Não foi possível abrir a imagem. {str(e)}")
        return
    
    print("\n🤖 Inicializando o RealtyProtoAI...")
    
    try:
        # Inicializar o agente
        agent = RealEstateGraphicDesigner()
        print("✅ Agente inicializado com sucesso!")
        
        print("\n🔍 Analisando a imagem...")
        
        # Processar a imagem
        suggestion = agent.process_image(image_path)
        
        print("\n" + "="*50)
        print("🏠 SUGESTÃO DE MELHORIA:")
        print("="*50)
        print(f"📝 {suggestion}")
        print("="*50)
        
        # Também fazer uma análise mais detalhada
        print("\n🔍 ANÁLISE DETALHADA:")
        print("-"*30)
        analysis = agent.analyze_image(image_path)
        
        print(f"📋 Descrição: {analysis['caption']}")
        print(f"🏠 Tipo de ambiente: {analysis['room_type']}")
        print(f"🎨 Estilo: {analysis['style']}")
        
        if analysis['editable_areas']:
            print(f"🔧 Áreas editáveis detectadas:")
            for area in analysis['editable_areas'][:5]:  # Mostrar apenas as primeiras 5
                print(f"   • {area}")
        
        clutter = analysis['clutter_analysis']
        print(f"🧹 Nível de bagunça: {clutter['clutter_level']}")
        print(f"📏 Uso do espaço: {clutter['space_utilization']}")
        
        print("\n✅ Processamento concluído com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro durante o processamento: {str(e)}")
        import traceback
        traceback.print_exc()

def main():
    """Função principal"""
    if len(sys.argv) != 2:
        print("💡 Uso: python test_image.py <caminho_da_imagem>")
        print("📝 Exemplo: python test_image.py minha_foto.jpg")
        return
    
    image_path = sys.argv[1]
    test_image(image_path)

if __name__ == "__main__":
    main()