// Database Schema Types for Finance Tracker
// This file defines TypeScript types and interfaces for the PostgreSQL database

// Category interface matching the JSON structure in database
export interface Category {
    value: string;
    label: string;
    icon: string; // Icon name as string (since JSON can't store LucideIcon)
  }
  
  // Main database table interface
  export interface FinanceTrackerUser {
    id: number;
    created_at: string; // ISO timestamp
    updated_at: string; // ISO timestamp
    
    // User authentication data from Google OAuth
    email: string;
    avatar?: string | null; // URL to user's Google profile picture
    
    // Google Sheets integration
    sheet_id?: string | null; // Google Sheets ID for user's personal sheet
    
    // User customizable categories (stored as JSON in database)
    expense_categories: Category[];
    income_categories: Category[];
    
    // Budget settings
    monthly_budget: number; // Decimal stored as number in TypeScript
    
    // Additional user preferences
    preferences: Record<string, any>; // JSON object for extensibility
    
    // Status and metadata
    is_active: boolean;
    last_login?: string | null; // ISO timestamp
  }
  
  // Input type for creating a new user (omits auto-generated fields)
  export interface CreateFinanceTrackerUser {
    email: string;
    avatar?: string;
    sheet_id?: string;
    expense_categories?: Category[];
    income_categories?: Category[];
    monthly_budget?: number;
    preferences?: Record<string, any>;
    is_active?: boolean;
  }
  
  // Input type for updating a user (all fields optional except id)
  export interface UpdateFinanceTrackerUser {
    id: number;
    email?: string;
    avatar?: string;
    sheet_id?: string;
    expense_categories?: Category[];
    income_categories?: Category[];
    monthly_budget?: number;
    preferences?: Record<string, any>;
    is_active?: boolean;
    last_login?: string;
  }
  
  // Default expense categories matching selections.ts
  export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
    { value: '🍔 Makan & Minum', label: 'Makan & Minum', icon: 'Utensils' },
    { value: '🥫 Camilan', label: 'Camilan', icon: 'Donut' },
    { value: '🛒 Bahan Masak', label: 'Bahan Masak', icon: 'ShoppingBasket' },
    { value: '🚗 Transportasi', label: 'Transportasi', icon: 'Bus' },
    { value: '🎓 Pendidikan', label: 'Pendidikan', icon: 'Book' },
    { value: '🍿 Hiburan', label: 'Hiburan', icon: 'Tv' },
    { value: '🎁 Hadiah & Donasi', label: 'Hadiah & Donasi', icon: 'Gift' },
    { value: '😊 Keluarga', label: 'Keluarga', icon: 'Users' },
    { value: '💊 Kesehatan', label: 'Kesehatan', icon: 'Heart' },
    { value: '🧾 Tagihan & Lainnya', label: 'Tagihan & Lainnya', icon: 'FileText' },
    { value: '💵 Biaya-biaya', label: 'Biaya-biaya', icon: 'DollarSign' },
    { value: '🛍️ Belanja', label: 'Belanja', icon: 'ShoppingBag' },
    { value: '💰 Investasi', label: 'Investasi', icon: 'ChartArea' },
    { value: '🏠 Akomodasi', label: 'Akomodasi', icon: 'Home' },
    { value: '🎲 Lainnya', label: 'Lainnya', icon: 'Dices' }
  ];
  
  // Default income categories matching selections.ts
  export const DEFAULT_INCOME_CATEGORIES: Category[] = [
    { value: '💰 Gaji', label: 'Gaji', icon: 'Banknote' },
    { value: '✍🏼 Event', label: 'Event', icon: 'PenLine' },
    { value: '💼 Bisnis', label: 'Bisnis', icon: 'BriefcaseBusiness' },
    { value: '🎁 Hadiah', label: 'Hadiah', icon: 'Landmark' },
    { value: '🎲 Lainnya', label: 'Lainnya', icon: 'Dices' }
  ];
  
  // Database query result types
  export interface DatabaseUser extends FinanceTrackerUser {
    // Any additional fields that might come from database queries
  }
  
  // API response types
  export interface UserProfile {
    id: number;
    email: string;
    avatar?: string;
    sheet_id?: string;
    monthly_budget: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }
  
  export interface UserCategories {
    expense_categories: Category[];
    income_categories: Category[];
  }
  
  export interface UserPreferences {
    preferences: Record<string, any>;
  }
  
  // Utility type for database operations
  export type UserUpdateFields = Partial<Omit<FinanceTrackerUser, 'id' | 'created_at' | 'updated_at'>>;
  
  // Error types for database operations
  export interface DatabaseError {
    code: string;
    message: string;
    detail?: string;
  }
  
  // Query filter types
  export interface UserQueryFilters {
    email?: string;
    is_active?: boolean;
    has_sheet?: boolean; // Users with sheet_id not null
  }
  
  // Pagination types
  export interface PaginationOptions {
    limit?: number;
    offset?: number;
    order_by?: keyof FinanceTrackerUser;
    order_direction?: 'ASC' | 'DESC';
  }
  
  export interface PaginatedResult<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  }
  
  // Helper functions for type conversion
  export class SchemaHelpers {
    /**
     * Convert database category JSON to typed Category array
     */
    static parseCategoriesFromDB(jsonCategories: any): Category[] {
      if (!jsonCategories || !Array.isArray(jsonCategories)) {
        return [];
      }
      return jsonCategories.map(cat => ({
        value: cat.value || '',
        label: cat.label || '',
        icon: cat.icon || 'Dices'
      }));
    }
  
    /**
     * Convert Category array to database-ready JSON
     */
    static categoriesToDB(categories: Category[]): string {
      return JSON.stringify(categories);
    }
  
    /**
     * Validate category structure
     */
    static validateCategory(category: any): category is Category {
      return (
        typeof category === 'object' &&
        typeof category.value === 'string' &&
        typeof category.label === 'string' &&
        typeof category.icon === 'string'
      );
    }
  
    /**
     * Validate categories array
     */
    static validateCategories(categories: any[]): categories is Category[] {
      return Array.isArray(categories) && categories.every(this.validateCategory);
    }
  
    /**
     * Create default user data
     */
    static createDefaultUser(email: string, avatar?: string): CreateFinanceTrackerUser {
      return {
        email,
        avatar,
        expense_categories: DEFAULT_EXPENSE_CATEGORIES,
        income_categories: DEFAULT_INCOME_CATEGORIES,
        monthly_budget: 0,
        preferences: {},
        is_active: true
      };
    }
  }
  
  // Export types for use in other parts of the application
  export type {
    FinanceTrackerUser as User,
    CreateFinanceTrackerUser as CreateUser,
    UpdateFinanceTrackerUser as UpdateUser
  };
  