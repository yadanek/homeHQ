/**
 * Unit Tests for FamiliesService
 * 
 * Tests business logic for family creation and management
 * with mocked Supabase client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FamiliesService, FamilyServiceError } from '@/services/families.service';
import type { SupabaseClient } from '@/db/supabase.client';
import type { CreateFamilyRequest } from '@/types';

// Mock Supabase client
const createMockSupabaseClient = () => ({
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
} as any as SupabaseClient);

describe('FamiliesService', () => {
  let mockSupabase: SupabaseClient;
  const testUserId = 'test-user-123';
  const testFamilyId = 'family-456';

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('createFamily', () => {
    const validRequest: CreateFamilyRequest = {
      name: 'Smith Family',
      display_name: 'John Smith'
    };

    describe('Success scenarios', () => {
      it('should create family successfully when user has no existing profile', async () => {
        // Mock: No existing profile
        (mockSupabase.from as any).mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        });

        // Mock: RPC call success
        (mockSupabase.rpc as any).mockResolvedValueOnce({
          data: testFamilyId,
          error: null
        });

        // Mock: Fetch created family
        (mockSupabase.from as any).mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: testFamilyId,
                  name: 'Smith Family',
                  created_at: '2026-01-27T12:00:00Z'
                },
                error: null
              })
            })
          })
        });

        // Mock: Fetch created profile
        (mockSupabase.from as any).mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: testUserId,
                  family_id: testFamilyId,
                  role: 'admin',
                  display_name: 'John Smith',
                  created_at: '2026-01-27T12:00:00Z'
                },
                error: null
              })
            })
          })
        });

        const result = await FamiliesService.createFamily(
          mockSupabase,
          testUserId,
          validRequest
        );

        expect(result).toEqual({
          id: testFamilyId,
          name: 'Smith Family',
          created_at: '2026-01-27T12:00:00Z',
          profile: {
            id: testUserId,
            family_id: testFamilyId,
            role: 'admin',
            display_name: 'John Smith',
            created_at: '2026-01-27T12:00:00Z'
          }
        });
      });

      it('should call database function with correct parameters', async () => {
        // Mock: No existing profile
        (mockSupabase.from as any).mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        });

        // Mock: RPC call
        const rpcMock = vi.fn().mockResolvedValue({
          data: testFamilyId,
          error: null
        });
        (mockSupabase.rpc as any) = rpcMock;

        // Mock: Fetch created data (simplified)
        (mockSupabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: testFamilyId, name: 'Smith Family', created_at: '2026-01-27T12:00:00Z', family_id: testFamilyId, role: 'admin', display_name: 'John Smith' },
                error: null
              })
            })
          })
        });

        await FamiliesService.createFamily(mockSupabase, testUserId, validRequest);

        expect(rpcMock).toHaveBeenCalledWith('create_family_and_assign_admin', {
          user_id: testUserId,
          family_name: 'Smith Family',
          user_display_name: 'John Smith'
        });
      });
    });

    describe('Error scenarios', () => {
      it('should throw USER_ALREADY_IN_FAMILY error when user has existing profile', async () => {
        const existingFamilyId = 'existing-family-789';

        // Mock: Existing profile found
        (mockSupabase.from as any).mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: testUserId,
                  family_id: existingFamilyId
                },
                error: null
              })
            })
          })
        });

        await expect(
          FamiliesService.createFamily(mockSupabase, testUserId, validRequest)
        ).rejects.toThrow(FamilyServiceError);

        try {
          await FamiliesService.createFamily(mockSupabase, testUserId, validRequest);
        } catch (error) {
          expect(error).toBeInstanceOf(FamilyServiceError);
          expect((error as FamilyServiceError).code).toBe('USER_ALREADY_IN_FAMILY');
          expect((error as FamilyServiceError).details?.family_id).toBe(existingFamilyId);
        }
      });

      it('should throw DATABASE_ERROR when profile check fails', async () => {
        // Mock: Database error on profile check
        (mockSupabase.from as any).mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Connection failed' }
              })
            })
          })
        });

        await expect(
          FamiliesService.createFamily(mockSupabase, testUserId, validRequest)
        ).rejects.toThrow(FamilyServiceError);

        try {
          await FamiliesService.createFamily(mockSupabase, testUserId, validRequest);
        } catch (error) {
          expect(error).toBeInstanceOf(FamilyServiceError);
          expect((error as FamilyServiceError).code).toBe('DATABASE_ERROR');
        }
      });

      it('should throw DATABASE_ERROR when RPC call fails', async () => {
        // Mock: No existing profile
        (mockSupabase.from as any).mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        });

        // Mock: RPC call failure
        (mockSupabase.rpc as any).mockResolvedValueOnce({
          data: null,
          error: { message: 'Function execution failed' }
        });

        await expect(
          FamiliesService.createFamily(mockSupabase, testUserId, validRequest)
        ).rejects.toThrow(FamilyServiceError);

        try {
          await FamiliesService.createFamily(mockSupabase, testUserId, validRequest);
        } catch (error) {
          expect(error).toBeInstanceOf(FamilyServiceError);
          expect((error as FamilyServiceError).code).toBe('DATABASE_ERROR');
          expect((error as FamilyServiceError).message).toContain('Failed to create family');
        }
      });

      it('should throw DATABASE_ERROR when family fetch fails', async () => {
        // Mock: No existing profile
        (mockSupabase.from as any).mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        });

        // Mock: RPC call success
        (mockSupabase.rpc as any).mockResolvedValueOnce({
          data: testFamilyId,
          error: null
        });

        // Mock: Family fetch failure
        (mockSupabase.from as any).mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Family not found' }
              })
            })
          })
        });

        await expect(
          FamiliesService.createFamily(mockSupabase, testUserId, validRequest)
        ).rejects.toThrow(FamilyServiceError);
      });
    });
  });
});
