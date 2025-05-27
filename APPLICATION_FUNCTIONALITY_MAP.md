# Smart Meal Planner - Application Functionality Map

This document provides a comprehensive overview of all files in the Smart Meal Planner application and their specific functionality. This is designed to improve search efficiency and code comprehension.

## Table of Contents
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Database Models](#database-models)
- [API Services](#api-services)
- [Integration Services](#integration-services)
- [Components](#components)
- [Pages](#pages)
- [Utilities](#utilities)

---

## Backend Architecture

### Main Application Entry Point
**`apps/smart-meal-planner-backend/app/main.py`**
- **Purpose**: FastAPI application initialization and configuration
- **Key Functions**: 
  - Router registration for all API endpoints
  - CORS middleware setup
  - Database table creation and migrations
  - S3 configuration validation
  - Health check endpoints
  - Environment variable logging
- **Key Routes**: `/health`, `/api-test`, `/check-s3-vars`

### API Routers (`apps/smart-meal-planner-backend/app/routers/`)

#### Authentication & User Management
**`auth.py`**
- **Purpose**: User authentication, registration, and session management
- **Key Endpoints**: Login, signup, token validation, password reset
- **Security**: JWT token management, password hashing

**`organizations.py`**
- **Purpose**: Organization (nutrition coach) management
- **Key Endpoints**: Organization CRUD, settings management

**`organization_clients.py` & `organization_clients_alt.py`**
- **Purpose**: Client management for nutrition coaches
- **Key Endpoints**: Client creation, assignment, profile management
- **Features**: Multiple implementation versions for compatibility

**`invitations.py` & `invitations_alt.py`**
- **Purpose**: Client invitation system for organizations
- **Key Endpoints**: Invitation creation, acceptance, validation
- **Features**: Token-based invitation workflow

**`client_resources.py`**
- **Purpose**: Client-specific resource access and management
- **Key Endpoints**: Client data retrieval, permissions

#### Menu & Recipe Management
**`menu.py`**
- **Purpose**: Core meal planning and menu generation
- **Key Endpoints**: Menu creation, AI-generated meal plans, menu sharing
- **Features**: Multi-day menu planning, dietary preference integration

**`custom_menu.py`**
- **Purpose**: Custom menu building from saved recipes
- **Key Endpoints**: Custom menu creation, recipe assignment to meals

**`meal_shopping_lists.py`** *(Recently Added)*
- **Purpose**: Generate shopping lists organized by individual meals
- **Key Endpoints**: `/menu/{menu_id}/meal-shopping-lists`
- **Features**: Raw ingredient display without unit conversion, meal-specific organization

**`saved_recipes.py` & `saved_recipes_alt.py`**
- **Purpose**: User recipe saving and management
- **Key Endpoints**: Recipe save/unsave, user recipe collections

**`recipe_admin.py`**
- **Purpose**: Administrative recipe database management
- **Key Endpoints**: Recipe CRUD for admins, bulk operations

**`scraped_recipes.py`**
- **Purpose**: Recipe data scraping and import functionality
- **Key Endpoints**: Recipe scraping, data import from external sources

**`organization_recipes.py`** *(Organization Recipe Management)*
- **Purpose**: Organization-specific recipe library management and approval workflow
- **Key Endpoints**: 
  - Recipe library CRUD (`/api/organization-recipes/{org_id}/recipes`)
  - Recipe categories management (`/api/organization-recipes/{org_id}/categories`)
  - Available recipes for adding (`/api/organization-recipes/{org_id}/available-recipes`)
  - Recipe approval workflow (`/api/organization-recipes/{org_id}/recipes/{recipe_id}/approve`)
  - Menu defaults and nutritional standards
- **Features**: Recipe approval workflow, categorization, tagging, compliance tracking, usage analytics

**`user_recipes.py`** *(Custom Recipe Creation)*
- **Purpose**: User and organization custom recipe creation and management
- **Key Endpoints**: Custom recipe CRUD, organization recipe sharing, recipe validation
- **Features**: Custom recipe builder, ingredient management, instruction steps, dietary tags

**`organization_settings.py`**
- **Purpose**: Organization configuration and settings management
- **Key Endpoints**: Organization profile, default preferences, team management
- **Features**: Default settings, compliance configuration

**`organization_branding.py`** *(White-Label Branding System)*
- **Purpose**: Organization branding and white-label customization management
- **Key Endpoints**: 
  - Branding CRUD (`/api/organization-branding/{org_id}`)
  - Public branding access (`/api/organization-branding/public/{org_id}`)
  - Branding validation and defaults
- **Features**: Custom colors, logos, messaging, feature toggles, client-facing branding, theme generation

**`onboarding_forms.py`**
- **Purpose**: Custom client onboarding form creation and management
- **Key Endpoints**: Form builder, form responses, template management
- **Features**: Dynamic form creation, 8 field types, response collection and analysis

**`client_notes.py`**
- **Purpose**: Private client notes and documentation system
- **Key Endpoints**: Note CRUD, templates, search and filtering
- **Features**: Note categories, priorities, templates, client progress tracking

#### Shopping & Commerce Integration
**`cart.py`**
- **Purpose**: Shopping cart management and store integration
- **Key Endpoints**: Internal cart operations, multi-store cart management
- **Features**: Kroger/Instacart cart synchronization, item management

**`grocery_list.py` & `meal_grocery_list.py`**
- **Purpose**: Shopping list generation and management
- **Key Endpoints**: List creation, ingredient aggregation, store integration

**`store.py`**
- **Purpose**: Store information and selection management
- **Key Endpoints**: Store lookup, location-based store finding

**`kroger_store.py` & `kroger_auth.py`**
- **Purpose**: Kroger API integration
- **Key Endpoints**: Kroger authentication, product search, store locations
- **Features**: OAuth flow, product matching, price information

**`instacart_store.py`, `instacart_cart.py`, `instacart_debug.py`, `instacart_status.py`**
- **Purpose**: Instacart API integration suite
- **Key Endpoints**: Instacart authentication, product search, cart operations, debugging
- **Features**: Retailer selection, product matching, order management, debug tools

**`walmart_store.py`**
- **Purpose**: Walmart integration (if implemented)
- **Key Endpoints**: Walmart API integration

#### Utility Routers
**`preferences.py`**
- **Purpose**: User dietary preferences and restrictions
- **Key Endpoints**: Preference CRUD, dietary restriction management

**`order.py`**
- **Purpose**: Order history and management
- **Key Endpoints**: Order tracking, purchase history

**`ai_status.py`**
- **Purpose**: AI service status and monitoring
- **Key Endpoints**: AI model availability, performance metrics

**`test_invitation.py`**
- **Purpose**: Invitation system testing and debugging
- **Key Endpoints**: Test invitation flows, debugging tools

---

## Database Models (`apps/smart-meal-planner-backend/app/models/`)

**`user.py`**
- **Purpose**: User account data models
- **Models**: User profiles, authentication data, account types
- **Features**: Multi-account types (individual, client, organization)

**`menus.py`**
- **Purpose**: Menu and meal plan data structures
- **Models**: Menu items, meal assignments, nutritional data
- **Features**: Multi-day planning, ingredient tracking

---

## Frontend Architecture

### Application Entry Point
**`apps/smart-meal-planner-web/src/App.js`**
- **Purpose**: Main React application component
- **Features**: Routing setup, authentication context, global state management

**`apps/smart-meal-planner-web/src/index.js`**
- **Purpose**: React application rendering and initialization
- **Features**: Root component mounting, provider setup

### Authentication & Context Management
**`apps/smart-meal-planner-web/src/context/AuthContext.js`**
- **Purpose**: Authentication state management across the application
- **Features**: User session handling, token management, login/logout flows

**`apps/smart-meal-planner-web/src/context/OrganizationContext.js`**
- **Purpose**: Organization context for nutrition coaching features
- **Features**: Organization data management, client context switching

**`apps/smart-meal-planner-web/src/context/BrandingContext.js`** *(White-Label Branding)*
- **Purpose**: Dynamic theme and branding context for organizations and clients
- **Features**: 
  - Organization branding application to clients
  - Dynamic theme generation from branding settings
  - User context detection (organization vs client vs individual)
  - Safety guards for individual user experience
  - Material-UI theme integration

### API Services (`apps/smart-meal-planner-web/src/services/`)

#### Core API Service
**`apiService.js`**
- **Purpose**: Primary API communication layer
- **Features**: Axios configuration, authentication headers, error handling
- **Endpoints**: All major backend API calls

#### Third-Party Integrations
**`krogerAuthService.js`**
- **Purpose**: Kroger OAuth and API communication
- **Features**: Authentication flow, product search, store integration

**`instacartService.js`**
- **Purpose**: Primary Instacart API integration
- **Features**: Product search, cart operations, retailer management

**`instacartBackendService.js`** (Multiple versions)
- **Purpose**: Backend-proxied Instacart API calls
- **Versions**: `NEW_`, `final_`, `updated_`, `proxy_` - different implementation approaches
- **Features**: Server-side Instacart integration, CORS handling

**`instacartAuthService.js`**
- **Purpose**: Instacart authentication management
- **Features**: API key management, session handling

**`instacartApiKeyTester.js`**
- **Purpose**: Instacart API connectivity testing
- **Features**: API validation, debugging tools

**`instacartDevTools.js`**
- **Purpose**: Development and debugging tools for Instacart integration
- **Features**: API testing, environment diagnostics

#### Mock Data Services
**`mockData/instacartRetailers.js`**
- **Purpose**: Mock Instacart retailer data for testing
- **Features**: Sample retailer information, testing data

**`mockData/instacartProducts.js`**
- **Purpose**: Mock product data for Instacart integration testing
- **Features**: Sample product search results, testing scenarios

---

## Pages (`apps/smart-meal-planner-web/src/pages/`)

### Authentication & User Management Pages

**`AcceptInvitation.jsx`** (`/accept-invitation`)
- **Purpose**: Handles client invitation acceptance from organization nutrition coaches  
- **Features**: Token validation, organization details display, authentication flow handling
- **URL Parameters**: `?token=...&org=...`

**`ClientSignupPage.jsx`** (`/client-signup`) 
- **Purpose**: Multi-step client registration process for nutrition coaching organizations
- **Features**: 3-step registration wizard, email verification, organization connection
- **URL Parameters**: `?token=...&org=...`

**`LoginPage.jsx`** (`/login`)
- **Purpose**: User authentication for all account types
- **Features**: Multi-account type login, password reset links

**`SignUpPage.jsx`** (`/signup`)
- **Purpose**: General user registration (non-client accounts)
- **Features**: Individual and organization account creation

**`VerifyEmailPage.jsx`** (`/verify-email`)
- **Purpose**: Email verification processing
- **Features**: Email confirmation handling, account activation

### Dashboard Pages

**`ClientDashboard.jsx`** (`/client-dashboard`)
- **Purpose**: Main dashboard for nutrition coaching clients
- **Features**: Shared meal plan display, quick actions, organization context
- **Access**: Client accounts only

**`OrganizationDashboard.jsx`** (`/organization/dashboard`)
- **Purpose**: Comprehensive dashboard for nutrition coaches/organizations with 8-tab interface
- **Features**: 
  - **Getting Started Tab**: Interactive onboarding guide with quick start checklist
  - **Clients Tab**: Client management overview, status tracking, quick actions
  - **Invitations Tab**: Client invitation system with email workflow
  - **Shared Menus Tab**: Menu sharing management and analytics  
  - **Client Recipes Tab**: Client recipe preference monitoring
  - **Onboarding Forms Tab**: Custom form builder with 8 field types, response management
  - **Client Notes Tab**: Private client documentation system with templates
  - **Recipe Library Tab**: Organization recipe library with approval workflow
  - **Custom Recipes Tab**: Organization-specific recipe creation and management
  - **Settings Tab**: Organization profile and configuration management
- **Access**: Organization accounts only

### Client Management Pages

**`ClientProfile.jsx`** (`/organization/clients/:clientId`)
- **Purpose**: Comprehensive client profile management for organization admins
- **Features**: 3-tab interface (Profile, Menus, Preferences), menu generation, sharing
- **Access**: Organization accounts only

**`ClientPreferencesPage.jsx`** (`/organization/clients/:clientId/preferences`)
- **Purpose**: Detailed nutritional and dietary preference configuration for clients
- **Features**: Comprehensive preference management, dietary restrictions, macro tracking
- **Access**: Organization accounts only

**`ClientInvitationConnect.jsx`** (`/client-invitation-connect`)
- **Purpose**: Authenticated client invitation connection process
- **Features**: Post-authentication invitation acceptance, organization connection
- **URL Parameters**: `?token=...&org=...`

### Organization Settings & Management Pages

**`OrganizationSettingsPage.jsx`** (`/organization/settings`)
- **Purpose**: Organization profile and configuration management
- **Features**: Organization details, default preferences, team management, branding management interface
- **Access**: Organization accounts only

**`OrganizationSetup.jsx`** (`/organization/setup`)
- **Purpose**: Initial organization account setup and configuration wizard
- **Features**: Step-by-step organization onboarding, profile setup, initial configuration
- **Access**: New organization accounts

### Menu & Recipe Management Pages

**`CustomMenuBuilderPage.jsx`** (`/custom-menu-builder`)
- **Purpose**: Create custom meal plans from saved recipes
- **Features**: Recipe selection interface, day/meal assignment, client-specific building

**`Menu.jsx`** (`/menu`)
- **Purpose**: Menu display and management
- **Features**: Menu viewing, sharing capabilities, multi-day display
- **URL Parameters**: `?menuId=...&clientId=...&share=...`

**`MenuDisplayPage.jsx`** (`/menu-display/:menuId`)
- **Purpose**: Dedicated menu viewing page with enhanced features
- **Features**: Detailed menu presentation, nutritional information
- **URL Parameters**: `?source=client` for client context

**`ExampleMealPlansPage.jsx`** (`/example-meal-plans`)
- **Purpose**: Display sample meal plans for demonstration and inspiration
- **Features**: Hardcoded example plans, macro information, meal categorization

### Recipe Management Pages

**`RecipeBrowserPage.jsx`** (`/recipes`)
- **Purpose**: Browse and discover recipes from the database
- **Features**: Search, filtering, categorization, recipe saving

**`RecipeDetailPage.jsx`** (`/recipes/:id`)
- **Purpose**: Individual recipe viewing with full details
- **Features**: Recipe information, nutritional data, save functionality, ingredient lists

**`SavedRecipesPage.jsx`** (`/saved-recipes`)
- **Purpose**: View and manage user's saved recipe collection
- **Features**: Saved recipe organization, search, removal, menu building integration

**`RecipeAdminPanel.jsx`** (`/recipe-admin`)
- **Purpose**: Administrative recipe database management
- **Features**: Recipe CRUD operations, bulk management, data import/export
- **Access**: Admin accounts only

### Shopping & Commerce Pages

**`CartPage.jsx`** (`/cart`)
- **Purpose**: Advanced shopping cart with multi-store integration
- **Features**: Kroger/Instacart integration, store dialogs, product search, error handling
- **URL Parameters**: `?clientId=...` for client context

**`ShoppingListPage.jsx`** (`/shopping-list/:menuId`)
- **Purpose**: Generate and manage shopping lists from meal plans
- **Features**: Ingredient aggregation, store integration, list management, By Meal view
- **URL Parameters**: `?source=client` for client context

**`ShoppingListTestPage.jsx`** (`/shopping-list-test`)
- **Purpose**: Testing interface for shopping list functionality
- **Features**: Debug tools, testing scenarios

### Preferences & Settings Pages

**`Preferences.jsx` / `PreferencesPage.jsx`** (`/preferences` / `/preferences-page`)
- **Purpose**: User preference management and profile settings
- **Features**: Dietary preferences, account settings, notification preferences

### Administrative & Testing Pages

**`OrganizationSetup.jsx`** (`/organization/setup`)
- **Purpose**: Organization account initialization and configuration
- **Features**: Organization setup wizard, initial configuration

**`ApiTestPage.jsx`** (`/api-test`)
- **Purpose**: Comprehensive API connectivity testing and diagnostics
- **Features**: Axios/Fetch testing, CORS diagnostics, environment validation, troubleshooting

**`InstacartTestPage.jsx`** (`/instacart-test`)
- **Purpose**: Instacart-specific API integration testing
- **Features**: Instacart API validation, retailer testing, authentication debugging

**`TestDebugPage.jsx`** (`/test-debug`)
- **Purpose**: General debugging and testing interface
- **Features**: System diagnostics, test data generation

### Authentication Callback & Landing Pages

**`KrogerAuthCallback.jsx`** (`/kroger/callback`)
- **Purpose**: Handle Kroger OAuth authentication returns
- **Features**: OAuth flow completion, token processing, error handling

**`Home.jsx` / `LandingPage.jsx`** (`/` or `/home`)
- **Purpose**: Application landing/homepage
- **Features**: Welcome interface, feature overview, getting started guide

---

## Components (`apps/smart-meal-planner-web/src/components/`)

### Navigation & Layout
**`NavBar.jsx`**
- **Purpose**: Main application navigation with user context
- **Features**: Account type-specific menus, mobile responsive, organization context, favicon integration
- **Recent Enhancement**: Added favicon before "Smart Meal Planner" text

**`Footer.jsx`**
- **Purpose**: Application footer with links and information
- **Features**: Contact information, legal links, app version

**`PrivateRoute.jsx`**
- **Purpose**: Route protection for authenticated users
- **Features**: Authentication verification, redirect handling

### Shopping & Commerce Components
**`MealShoppingList.jsx`** *(Recently Enhanced)*
- **Purpose**: Display shopping lists organized by individual meals
- **Features**: Raw ingredient display, cart integration for both Kroger and Instacart, meal-by-meal organization
- **Recent Enhancement**: Added cart buttons for each meal with internal cart integration

**`ShoppingList.jsx`, `ShoppingListSimplified.jsx`, `ShoppingListDebug.jsx`**
- **Purpose**: Various shopping list display components
- **Features**: Different presentation styles, debugging capabilities, simplified views

**`CategorizedShoppingList.jsx`**
- **Purpose**: Shopping list with ingredient categorization
- **Features**: Category-based organization, store section mapping

**`SmartShoppingList.jsx`, `SmartIngredientDisplay.jsx`**
- **Purpose**: AI-enhanced shopping list features
- **Features**: Smart ingredient recognition, enhanced display

### Menu & Recipe Components
**`MenuDisplay.jsx`**
- **Purpose**: Menu presentation and interaction
- **Features**: Multi-day display, meal breakdown, nutritional information

**`ClientMenuGenerator.jsx`**
- **Purpose**: Menu generation interface for client management
- **Features**: AI-powered menu creation, preference integration

**`RecipeEditor.jsx`**
- **Purpose**: Recipe creation and editing interface
- **Features**: Ingredient management, instruction editing, nutritional calculation

**`AddRecipeForm.jsx`**
- **Purpose**: New recipe creation form
- **Features**: Step-by-step recipe input, validation

**`RecipeSaveButton.jsx`, `RecipeSaveDialog.jsx`**
- **Purpose**: Recipe saving functionality
- **Features**: Save/unsave recipes, collection management

**`ClientSavedRecipes.jsx`**
- **Purpose**: Client-specific saved recipe management
- **Features**: Organization client recipe access

### Organization Recipe Management Components
**`OrganizationRecipeLibrary.jsx`** *(Organization Recipe Library)*
- **Purpose**: Comprehensive organization recipe library management interface
- **Features**: 
  - 4-tab interface: Recipe Library, Approval Queue, Categories, Analytics
  - Recipe browsing and search with filters (category, status, approval)
  - Recipe approval workflow with status tracking (draft, pending, approved, needs_revision)
  - Recipe categorization with color-coded categories
  - Recipe details view with full nutritional and instruction information
  - Recipe editing with tags, internal notes, and client notes
  - Usage analytics and most-used recipe tracking
  - Integration with scraped recipe catalog for adding new recipes

**`OrganizationCustomRecipes.jsx`** *(Custom Recipe Creation)*
- **Purpose**: Organization-specific custom recipe creation and management
- **Features**:
  - Custom recipe creation from scratch
  - Recipe editing and management interface
  - Diet tag management and categorization
  - Image upload and recipe presentation
  - Recipe sharing within organization
  - Integration with CustomRecipeCreationDialog for detailed recipe input

**`CustomRecipeCreationDialog.jsx`** *(Recipe Creation Dialog)*
- **Purpose**: Comprehensive recipe creation and editing dialog
- **Features**:
  - Multi-step recipe creation wizard
  - Ingredient management with quantities and units
  - Step-by-step instruction creation
  - Nutritional information input
  - Diet tag assignment
  - Image upload and management
  - Recipe validation and error handling
  - Support for both user and organization recipe creation modes

### Organization Management Components  
**`OrganizationGettingStarted.jsx`** *(Organization Onboarding)*
- **Purpose**: Comprehensive getting started guide for new organizations
- **Features**:
  - 4-tab interface: Quick Start, All Features, Workflow Guide, Tips & Best Practices
  - Interactive quick start checklist with progress tracking
  - Detailed feature explanations with benefits and how-to guides
  - Workflow guidance for organization setup and client management
  - Best practice tips for successful nutrition coaching
  - Integration with organization dashboard navigation

**`ClientNotesManager.jsx`** *(Client Notes System)*
- **Purpose**: Private client notes and documentation management
- **Features**:
  - Note creation with categories, priorities, and types
  - Note templates for common scenarios
  - Search and filtering capabilities
  - Client-specific note organization
  - Professional documentation tools

**`OnboardingFormBuilder.jsx`** *(Form Creation)*
- **Purpose**: Custom client onboarding form creation interface
- **Features**:
  - 8 different field types (text, select, radio, checkbox, etc.)
  - Drag-and-drop form building
  - Form preview and testing
  - Template system for common forms
  - Response collection and management

**`OrganizationSetupCheck.jsx`** *(Setup Validation)*
- **Purpose**: Organization setup progress validation
- **Features**: Setup progress checking, requirement validation, onboarding completion tracking

### Store Integration Components
**`StoreSelector.jsx`**
- **Purpose**: Store selection interface for shopping
- **Features**: Location-based store finding, preference saving

**`KrogerResults.jsx`, `WalmartResults.jsx`, `InstacartResults.jsx`**
- **Purpose**: Store-specific search result displays
- **Features**: Product search results, pricing, store-specific formatting

**`InstacartRetailerSelector.jsx`**
- **Purpose**: Instacart retailer selection interface
- **Features**: Retailer browsing, selection, location-based filtering

### Testing & Development Components
**`InstacartApiTester.jsx`, `InstacartSimpleTester.jsx`, `InstacartTester.jsx`**
- **Purpose**: Instacart API testing and debugging interfaces
- **Features**: API validation, test scenarios, debug information

### User Interface Components
**`MacroDisplay.jsx`, `MacroDefaults.jsx`**
- **Purpose**: Nutritional macro information display
- **Features**: Macro breakdown, default value management

**`ModelSelectionDialog.jsx`**
- **Purpose**: AI model selection interface
- **Features**: Model switching, configuration options

**`MenuSharingModal.jsx`**
- **Purpose**: Menu sharing functionality
- **Features**: Share link generation, access control

**`ZipCodeDialog.jsx`**
- **Purpose**: Location input for store finding
- **Features**: ZIP code validation, location services

**`ErrorBoundary.jsx`**
- **Purpose**: React error boundary for error handling
- **Features**: Error catching, fallback UI, error reporting

**`OrganizationSetupCheck.jsx`**
- **Purpose**: Organization setup validation
- **Features**: Setup progress checking, requirement validation

### Organization Branding Components
**`OrganizationBrandingManager.jsx`** *(White-Label Branding Management)*
- **Purpose**: Comprehensive organization branding management interface
- **Features**:
  - 4-tab interface: Visual Design, Layout, Messaging, Features
  - Primary/secondary color customization with color picker
  - Logo upload and management (main logo, favicon, header logo)
  - Custom messaging (welcome messages, taglines, descriptions)
  - Feature toggles (enable/disable specific application features)
  - Real-time preview of branding changes
  - Branding reset to defaults functionality
  - Integration with Material-UI theme system

---

## Utilities & Data Files

### Frontend Utilities (`apps/smart-meal-planner-web/src/utils/`)
**`shoppingListUtils.js`**
- **Purpose**: Shopping list processing utilities
- **Features**: List formatting, ingredient processing

**`unitStandardization.js`**
- **Purpose**: Unit conversion and standardization
- **Features**: Measurement conversion, unit normalization

**`smartShoppingListProcessor.js`**
- **Purpose**: AI-enhanced shopping list processing
- **Features**: Smart categorization, duplicate detection

### Backend Utilities (`apps/smart-meal-planner-backend/app/utils/`)
**`auth_middleware.py`, `auth_utils.py`**
- **Purpose**: Authentication utilities and middleware
- **Features**: Token validation, user verification, security helpers

**`grocery_aggregator.py`**
- **Purpose**: Grocery list aggregation and processing
- **Features**: Ingredient combination, unit conversion, categorization

**`meal_grocery_generator.py`**
- **Purpose**: Generate grocery lists from meal plans
- **Features**: Meal-to-grocery conversion, shopping list creation

**`s3/s3_utils.py`**
- **Purpose**: Amazon S3 integration utilities
- **Features**: File upload, image management, cloud storage

### Data Configuration Files
**`apps/smart-meal-planner-web/src/data/categoryMapping.js`**
- **Purpose**: Ingredient category mapping for store organization
- **Features**: Category definitions, store section mapping

**`apps/smart-meal-planner-web/src/data/ingredient_replacements.json`**
- **Purpose**: Ingredient substitution data
- **Features**: Alternative ingredient suggestions, dietary accommodations

**`apps/smart-meal-planner-backend/app/data/ingredient_config.json`**
- **Purpose**: Backend ingredient configuration
- **Features**: Ingredient processing rules, validation settings

---

## Key Architecture Patterns

### Multi-Tenant Design
- **Client vs. Organization Context**: Separate dashboards, features, and access levels
- **Account Types**: Individual, client, organization, admin with role-based access
- **White-Label Branding**: Organization-specific theming and branding for client interfaces

### Integration Architecture
- **Third-Party APIs**: Comprehensive Kroger and Instacart integration
- **Fallback Systems**: Multiple service implementations for reliability
- **Error Handling**: Robust error boundaries and fallback mechanisms

### Data Flow Patterns
- **Menu → Shopping List**: AI-generated menus convert to organized shopping lists
- **Recipe Saving**: Cross-user recipe sharing with organization context
- **Cart Integration**: Multi-store cart management with internal state

### State Management
- **Context Providers**: Authentication, organization, and branding context throughout app
- **Local State**: Component-level state for UI interactions
- **API State**: Server state management through custom hooks and services
- **Dynamic Theming**: Real-time theme updates based on organization branding settings

### Testing & Development
- **Multiple Environments**: Development, staging, production configurations
- **Debug Tools**: Comprehensive testing interfaces and debugging components
- **Mock Data**: Test data and scenarios for development

---

## Recent Enhancements

### Organization Branding System (Phase 4A - Latest Feature)
- **Backend**: New `organization_branding.py` router and branding models for white-label customization
- **Frontend**: `OrganizationBrandingManager.jsx` with 4-tab interface (Visual Design, Layout, Messaging, Features)
- **Features**: Custom colors, logos, messaging, feature toggles, client-facing branding application
- **Context**: `BrandingContext.js` for dynamic theme application to organization clients
- **Database**: JSONB branding_settings column in organization_settings table with migration
- **Models**: Comprehensive Pydantic models for branding validation (`branding.py`)

### Organization Recipe Management System (Previous Major Feature)
- **Backend**: New `organization_recipes.py` router for comprehensive recipe library management
- **Frontend**: `OrganizationRecipeLibrary.jsx` with 4-tab interface (Library, Approval Queue, Categories, Analytics)
- **Features**: Recipe approval workflow, categorization, tagging, usage analytics, integration with catalog
- **Custom Recipes**: `OrganizationCustomRecipes.jsx` and `CustomRecipeCreationDialog.jsx` for organization-specific recipe creation
- **Getting Started**: Enhanced `OrganizationGettingStarted.jsx` with recipe library and branding guidance

### Comprehensive Organization Dashboard Enhancement
- **Multi-Tab Interface**: 8-tab organization dashboard covering all aspects of nutrition coaching
- **Client Management**: Enhanced client onboarding, notes system, and preference management
- **Onboarding Forms**: Custom form builder with 8 field types and response management
- **Client Notes**: Private documentation system with templates and categorization

### Shopping List by Meal (Previous Feature)
- **Backend**: New `meal_shopping_lists.py` router for meal-organized shopping lists
- **Frontend**: Enhanced `MealShoppingList.jsx` with cart integration
- **Features**: Individual meal ingredient display, cart buttons for Kroger/Instacart

### Cart Integration
- **Internal Cart System**: Multi-store cart accumulation before shopping
- **Store Assignment**: Items organized by preferred store (Kroger/Instacart)
- **Workflow**: Add multiple meals to cart, then proceed to store checkout

### UI Improvements
- **Navigation Enhancement**: Favicon added to header for better branding
- **Responsive Design**: Mobile-first approach with drawer navigation
- **Error Handling**: Comprehensive error boundaries and user feedback

---

This documentation serves as a comprehensive map of the Smart Meal Planner application's functionality, enabling more efficient code navigation, debugging, and feature development.