import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from '../src/admin/admin.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PushService } from '../src/notifications/push.service';

describe('AdminService (unit)', () => {
  let service: AdminService;
  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const mockPush = {} as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  it('changes role when inputs are valid', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'CUSTOMER' });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1', role: 'ADMIN' });

    const res = await service.changeUserRole('u1', 'ADMIN');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { role: 'ADMIN' } });
    expect(res).toEqual({ success: true, message: 'Role changed to ADMIN' });
  });

  it('throws on invalid role', async () => {
    await expect(service.changeUserRole('u1', 'NOPE')).rejects.toThrow(BadRequestException);
  });

  it('throws when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.changeUserRole('u1', 'ADMIN')).rejects.toThrow(NotFoundException);
  });
});
