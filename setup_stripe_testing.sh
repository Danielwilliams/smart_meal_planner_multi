#!/bin/bash
# Setup script for Stripe subscription testing

echo "Setting up environment for Stripe subscription testing..."

# Create a virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install required Python packages
echo "Installing required Python packages..."
pip install -r apps/smart-meal-planner-backend/requirements.txt
pip install stripe==7.7.0 python-dotenv python-multipart fastapi uvicorn

# Set up backend environment file
echo "Setting up backend environment file..."
cp apps/smart-meal-planner-backend/.env.stripe-sample apps/smart-meal-planner-backend/.env

echo "IMPORTANT: Edit the .env file with your actual Stripe API keys and price IDs"
echo "You can find these in your Stripe dashboard at https://dashboard.stripe.com/test/apikeys"

# Set up frontend environment file
echo "Setting up frontend environment file..."
cp apps/smart-meal-planner-web/.env.stripe-sample apps/smart-meal-planner-web/.env

echo "IMPORTANT: Edit the frontend .env file with your Stripe publishable key"

# Install Stripe CLI if not already installed
if ! command -v stripe &> /dev/null; then
    echo "Stripe CLI not found. Installing..."
    echo "Please follow the instructions at https://stripe.com/docs/stripe-cli to install the Stripe CLI manually."
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd apps/smart-meal-planner-web
npm install
npm install @stripe/stripe-js @stripe/react-stripe-js
cd ../..

echo "Setup complete! Next steps:"
echo "1. Edit the .env files with your actual Stripe API keys"
echo "2. Start the backend with: cd apps/smart-meal-planner-backend && uvicorn app.main:app --reload"
echo "3. Start the frontend with: cd apps/smart-meal-planner-web && npm start"
echo "4. Start webhook forwarding with: ./test-stripe-webhook.sh"