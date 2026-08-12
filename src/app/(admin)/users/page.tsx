'use client';

import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import api from '@/lib/axios';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  MoreHorizontal, 
  Search, 
  UserCog, 
  ShieldAlert,
  Mail,
  Trash2,
  Wallet
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ListPagination } from '@/components/ui/list-pagination';
import { DEFAULT_PAGE_SIZE, parsePaginatedResponse } from '@/lib/pagination';

interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  externalUserId?: string;
  role: 'user' | 'owner' | 'admin';
  isVerified: boolean;
  createdAt: string;
  orderStats?: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalCommissionEarned: number;
    hasCompletedOrder: boolean;
    lastOrderAt?: string | null;
  };
}

type RoleChip = 'user' | 'owner' | 'admin';
type CustomerSegment = 'all' | 'new' | 'ordered';

const ROLE_CHIPS: Array<{ value: RoleChip; label: string }> = [
  { value: 'user', label: 'Customers' },
  { value: 'owner', label: 'Owners' },
  { value: 'admin', label: 'Admins' },
];

const CUSTOMER_SEGMENTS: Array<{ value: CustomerSegment; label: string }> = [
  { value: 'all', label: 'All customers' },
  { value: 'new', label: 'New' },
  { value: 'ordered', label: 'Ordered' },
];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleChip>('user');
  const [customerSegment, setCustomerSegment] = useState<CustomerSegment>('all');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, customerSegment, debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ['users', debouncedSearch, roleFilter, customerSegment, page],
    queryFn: async () => {
      const response = await api.get(`/users`, {
        params: {
          search: debouncedSearch || undefined,
          role: roleFilter,
          customerSegment:
            roleFilter === 'user' && customerSegment !== 'all'
              ? customerSegment
              : undefined,
          page,
          limit: DEFAULT_PAGE_SIZE,
        },
      });
      return parsePaginatedResponse<User>(response.data);
    },
    placeholderData: keepPreviousData,
  });

  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const response = await api.put(`/users/${id}`, { role });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User role updated successfully');
    },
    onError: () => {
      toast.error('Failed to update role');
    }
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500 text-white">Admin</Badge>;
      case 'owner':
        return <Badge className="bg-[#98E32F] text-[#013644]">Owner</Badge>;
      default:
        return <Badge variant="outline" className="text-white/40 border-white/10">Customer</Badge>;
    }
  };

  const activeLabel =
    ROLE_CHIPS.find((c) => c.value === roleFilter)?.label ?? 'Customers';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-white/50 text-sm">
            Viewing {activeLabel.toLowerCase()} only
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Search name, email, phone, PFU id..."
            className="pl-9 bg-[#002833] border-white/10 text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ROLE_CHIPS.map((chip) => {
          const active = roleFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => {
                setRoleFilter(chip.value);
                setPage(1);
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition-colors ${
                active
                  ? 'bg-[#98E32F] text-[#013644] border-[#98E32F]'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {roleFilter === 'user' ? (
        <div className="flex flex-wrap gap-2">
          {CUSTOMER_SEGMENTS.map((chip) => {
            const active = customerSegment === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => {
                  setCustomerSegment(chip.value);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition-colors ${
                  active
                    ? 'bg-sky-400 text-[#013644] border-sky-400'
                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <Card className="bg-[#002833] border-white/5 text-white overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">User</TableHead>
                <TableHead className="text-white/60">Phone</TableHead>
                <TableHead className="text-white/60">Role</TableHead>
                <TableHead className="text-white/60">Email Status</TableHead>
                <TableHead className="text-white/60">Joined</TableHead>
                <TableHead className="text-right text-white/60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-white/40">
                    Loading {activeLabel.toLowerCase()}...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-white/40">
                    No {activeLabel.toLowerCase()} found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user._id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#98E32F]/20 to-[#98E32F]/10 flex items-center justify-center font-bold text-[#98E32F] border border-[#98E32F]/20">
                          {(user.name || '?')[0]}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{user.name || '—'}</span>
                            {user.orderStats?.hasCompletedOrder ? (
                              <Badge className="bg-sky-500/15 text-sky-200 border border-sky-400/30">
                                Ordered
                              </Badge>
                            ) : null}
                          </div>
                          <span className="text-[10px] text-white/40 font-mono tracking-wider uppercase">
                            {user.externalUserId || `${user._id.substring(0, 8)}...`}
                          </span>
                          <span className="text-[10px] text-white/30">
                            Joined {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/70 text-sm font-mono">
                      {user.phone || '—'}
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.isVerified ? (
                          <Badge variant="outline" className="border-[#98E32F]/20 text-[#98E32F] bg-[#98E32F]/5">Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-500/20 text-red-400 bg-red-400/5">Unverified</Badge>
                        )}
                        <span className="text-xs text-white/40 truncate max-w-[150px]">{user.email || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/55 text-xs whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-[#98E32F]/10 hover:text-[#98E32F]">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#002833] border-white/5 text-white">
                          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <Link href={`/users/${user._id}`}>
                            <DropdownMenuItem className="focus:bg-white/10">
                              <UserCog className="mr-2 h-4 w-4" /> View details
                            </DropdownMenuItem>
                          </Link>
                          <Link href={`/users/${user._id}/payments`}>
                            <DropdownMenuItem className="text-[#98E32F] focus:text-[#98E32F] focus:bg-[#98E32F]/10">
                              <Wallet className="mr-2 h-4 w-4" /> Payments & refunds
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem onClick={() => {}}>
                            <Mail className="mr-2 h-4 w-4" /> Email User
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuLabel className="text-[10px] uppercase text-white/20">Change Role</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: user._id, role: 'user' })}>
                            <UserCog className="mr-2 h-4 w-4" /> Set as Customer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: user._id, role: 'owner' })}>
                            <UserCog className="mr-2 h-4 w-4" /> Set as Owner
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: user._id, role: 'admin' })}>
                            <ShieldAlert className="mr-2 h-4 w-4" /> Set as Admin
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-500/10">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ListPagination
            page={page}
            limit={DEFAULT_PAGE_SIZE}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
