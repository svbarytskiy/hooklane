import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { isUniqueViolation } from 'src/database/postgres-error';
import { profiles, workspaceMembers, workspaces } from 'src/database/schema';

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async createWorkspace(userId: string, name: string, slug: string) {
    try {
      return await this.db.transaction(async (tx) => {
        const [workspace] = await tx
          .insert(workspaces)
          .values({ name, slug })
          .returning();

        if (!workspace) {
          throw new Error('Workspace was not created');
        }

        await tx.insert(workspaceMembers).values({
          workspaceId: workspace.id,
          userId,
          role: 'owner',
        });

        return {
          ...workspace,
          role: 'owner' as const,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Workspace slug already exists');
      }

      throw error;
    }
  }

  async getWorkspaces(userId: string) {
    return this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(desc(workspaces.createdAt));
  }

  async getWorkspace(userId: string, workspaceId: string) {
    const [workspace] = await this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async getMembership(userId: string, workspaceId: string) {
    const [membership] = await this.db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    return {
      id: membership.workspaceId,
      role: membership.role,
    };
  }

  async listMembers(userId: string, workspaceId: string) {
    await this.getMembership(userId, workspaceId);

    return this.db
      .select({
        userId: workspaceMembers.userId,
        email: profiles.email,
        role: workspaceMembers.role,
        createdAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .leftJoin(profiles, eq(profiles.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(asc(workspaceMembers.createdAt));
  }
}
