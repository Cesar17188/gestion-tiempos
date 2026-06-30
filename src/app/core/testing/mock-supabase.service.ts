import { Injectable } from '@angular/core';
import { vi } from 'vitest';

@Injectable({
  providedIn: 'root'
})
export class MockSupabaseService {
  
  // Mocks de la sesión y autenticación
  auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user', email: 'test@test.com' } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null })
  };

  // Mock de la base de datos transaccional con una estructura encadenable
  private mockDbQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: {}, error: null }),
    then: vi.fn((resolve) => resolve({ data: [], error: null }))
  };

  db = vi.fn((table: string) => this.mockDbQuery);
  from = vi.fn((table: string) => this.mockDbQuery);
  supabase = { auth: this.auth };

  // Mock de storage
  storage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://test-url.com/image.jpg' } })
    })
  };
}
