#!/bin/bash
DEPLOY_PATH="$HOME/Library/Containers/com.luckymarmot.Paw/Data/Library/Application Support/com.luckymarmot.Paw/Extensions"
echo "auto deployment to: ${DEPLOY_PATH}"
cp -R ./dist/com.luckymarmot.PawExtensions.OpenAPIv3Generator "$DEPLOY_PATH"