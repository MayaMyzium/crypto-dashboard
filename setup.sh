#!/bin/bash

echo "🚀 虛擬貨幣分析儀表板 - 自動化設置腳本"
echo "================================================"

# 檢查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安裝。請先安裝 Node.js 18+ 版本"
    echo "下載地址: https://nodejs.org/"
    exit 1
fi

# 檢查Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 未安裝。請先安裝 Python 3.8+ 版本"
    echo "下載地址: https://python.org/"
    exit 1
fi

echo "✅ 環境檢查通過"

# 設置前端
echo "📦 安裝前端依賴..."
cd crypto-dashboard
npm install
if [ $? -ne 0 ]; then
    echo "❌ 前端依賴安裝失敗"
    exit 1
fi
echo "✅ 前端依賴安裝完成"

# 設置後端
echo "🐍 設置後端環境..."
cd ../crypto-api

# 檢查虛擬環境是否存在
if [ ! -d "venv" ]; then
    echo "創建Python虛擬環境..."
    python3 -m venv venv
fi

# 啟動虛擬環境並安裝依賴
source venv/bin/activate
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ 後端依賴安裝失敗"
    exit 1
fi
echo "✅ 後端依賴安裝完成"

# 構建前端
echo "🔨 構建前端應用..."
cd ../crypto-dashboard
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 前端構建失敗"
    exit 1
fi

# 複製到Flask靜態目錄
echo "📁 複製前端文件到後端..."
cp -r dist/* ../crypto-api/src/static/
echo "✅ 文件複製完成"

echo ""
echo "🎉 設置完成！"
echo ""
echo "啟動應用："
echo "cd crypto-api && source venv/bin/activate && python src/main.py"
echo ""
echo "然後訪問: http://localhost:5000"
echo ""
echo "開發模式："
echo "前端: cd crypto-dashboard && npm run dev"
echo "後端: cd crypto-api && source venv/bin/activate && python src/main.py"

