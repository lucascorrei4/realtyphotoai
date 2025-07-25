# 🚀 Deploy no Heroku - Real Estate Graphic Designer

Este guia mostra como fazer o deploy da aplicação no Heroku.

## ✅ Arquivos já configurados

Os seguintes arquivos já foram criados e configurados para o Heroku:

- `Procfile` - Define como executar a aplicação
- `runtime.txt` - Especifica a versão do Python
- `requirements.txt` - Dependências atualizadas para Heroku
- `app.json` - Configuração da aplicação
- `heroku.yml` - Configuração adicional do build
- `.slugignore` - Arquivos a serem ignorados no deploy
- `start.sh` - Script de inicialização

## 🔧 Passos para Deploy

### 1. Instalar Heroku CLI (se não instalado)
```bash
curl https://cli-assets.heroku.com/install.sh | sh
```

### 2. Login no Heroku
```bash
heroku login
```

### 3. Criar aplicação no Heroku
```bash
heroku create seu-app-name-aqui
```
Ou deixe o Heroku gerar um nome automaticamente:
```bash
heroku create
```

### 4. Configurar buildpack (opcional)
```bash
heroku buildpacks:set heroku/python
```

### 5. Deploy da aplicação
```bash
git push heroku HEAD:main
```

### 6. Abrir a aplicação
```bash
heroku open
```

## 🔍 Comandos úteis

### Ver logs da aplicação
```bash
heroku logs --tail
```

### Reiniciar a aplicação
```bash
heroku restart
```

### Ver status da aplicação
```bash
heroku ps
```

### Configurar variáveis de ambiente (se necessário)
```bash
heroku config:set VARIABLE_NAME=value
```

## 📝 Modificações feitas para Heroku

### 1. `app.py`
- Modificado para usar a porta do Heroku (`PORT` environment variable)
- Removido `share=True` para evitar problemas de tunneling

### 2. `requirements.txt`
- Alterado `opencv-python` para `opencv-python-headless` (compatível com Heroku)
- Adicionado versões CPU do PyTorch para reduzir tamanho
- Adicionado `gunicorn` para servidor de produção

### 3. `Procfile`
- Define comando para executar a aplicação web

### 4. `runtime.txt`
- Especifica Python 3.11.9 (compatível com Heroku)

## ⚠️ Limitações no Heroku

1. **Memória**: Plano gratuito tem limite de 512MB RAM
2. **Timeout**: Requests têm timeout de 30 segundos
3. **Armazenamento**: Sistema de arquivos é efêmero
4. **Sleep**: Aplicação "dorme" após 30 minutos de inatividade

## 🎯 Alternativas se o Heroku falhar

Se houver problemas com recursos no Heroku, considere:

1. **Railway**: `railway login && railway deploy`
2. **Render**: Deploy via GitHub
3. **Streamlit Cloud**: Para apps Streamlit
4. **Google Cloud Run**: Para containers Docker

## 🔧 Troubleshooting

### Erro de memória
- Reduza o tamanho dos modelos AI
- Use versões "lite" das bibliotecas
- Considere lazy loading dos modelos

### Timeout na inicialização
- Otimize o tempo de carregamento dos modelos
- Use cache para modelos pré-carregados

### Build falha
- Verifique `requirements.txt`
- Confirme compatibilidade das versões
- Veja logs com `heroku logs --tail`

## 📱 Testando localmente

Antes do deploy, teste localmente:

```bash
# Instalar dependências
pip install -r requirements.txt

# Executar aplicação
python app.py
```

A aplicação estará disponível em `http://localhost:7860`

## 🌐 Exemplo de URL final

Após o deploy, sua aplicação estará disponível em:
```
https://seu-app-name.herokuapp.com
```

## 💡 Dicas

1. Use nomes descritivos para sua aplicação
2. Monitore o uso de recursos nos logs
3. Considere upgrade para plano pago se necessário
4. Mantenha backups do código no GitHub