#!/usr/bin/env python3
"""
Simple test script to verify the Real Estate Photo AI Backend setup
"""
import sys
import os

def test_imports():
    """Test if all required packages can be imported"""
    try:
        import pydantic
        print("✅ pydantic imported successfully")
        
        import pydantic_settings
        print("✅ pydantic_settings imported successfully")
        
        import fastapi
        print("✅ fastapi imported successfully")
        
        import uvicorn
        print("✅ uvicorn imported successfully")
        
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def test_config():
    """Test configuration loading"""
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        from src.core.config import get_settings
        
        settings = get_settings()
        print("✅ Configuration loaded successfully")
        print(f"   App Name: {settings.app_name}")
        print(f"   Debug Mode: {settings.debug}")
        print(f"   Port: {settings.port}")
        print(f"   Host: {settings.host}")
        
        return True
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        return False

def test_fastapi_app():
    """Test FastAPI application creation"""
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        from main import app
        
        print("✅ FastAPI application created successfully")
        print(f"   App title: {app.title}")
        print(f"   App version: {app.version}")
        
        return True
    except Exception as e:
        print(f"❌ FastAPI app error: {e}")
        return False

def main():
    """Run all tests"""
    print("🔍 Testing Real Estate Photo AI Backend Setup")
    print("=" * 50)
    
    tests = [
        ("Package Imports", test_imports),
        ("Configuration", test_config),
        ("FastAPI Application", test_fastapi_app),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}:")
        if test_func():
            passed += 1
        else:
            print("   Skipping remaining tests due to failure...")
            break
    
    print("\n" + "=" * 50)
    print(f"📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your backend is ready to run.")
        print("\n🚀 Next steps:")
        print("   1. Run: python main.py")
        print("   2. Visit: http://localhost:8000/docs")
        print("   3. Test with Insomnia using the provided guide")
    else:
        print("❌ Some tests failed. Please install missing dependencies.")
        print("\n🔧 Try running:")
        print("   pip install --user fastapi uvicorn python-multipart pydantic pydantic-settings python-dotenv")

if __name__ == "__main__":
    main() 