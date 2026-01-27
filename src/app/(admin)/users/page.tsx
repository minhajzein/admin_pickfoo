'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Trash2
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'owner' | 'admin';
  isVerified: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users', search, roleFilter],
    queryFn: async () => {
      const response = await api.get(`/users?search=${search}&role=${roleFilter}`);
      return response.data.data;
    },
  });

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
        return <Badge variant="outline" className="text-white/40 border-white/10">User</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-white/50 text-sm">Monitor and manage all user accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9 bg-[#002833] border-white/10 text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="bg-[#002833] border border-white/10 text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#98E32F]"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="user">Users</option>
            <option value="owner">Owners</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      <Card className="bg-[#002833] border-white/5 text-white overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">User</TableHead>
                <TableHead className="text-white/60">Role</TableHead>
                <TableHead className="text-white/60">Email Status</TableHead>
                <TableHead className="text-white/60">Joined</TableHead>
                <TableHead className="text-right text-white/60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-white/40">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-white/40">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((user) => (
                  <TableRow key={user._id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#98E32F]/20 to-[#98E32F]/10 flex items-center justify-center font-bold text-[#98E32F] border border-[#98E32F]/20">
                          {user.name[0]}
                        </div>
                        <div className="flex flex-col">
                          <span>{user.name}</span>
                          <span className="text-[10px] text-white/40 font-mono tracking-wider uppercase">{user._id.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.isVerified ? (
                          <Badge variant="outline" className="border-[#98E32F]/20 text-[#98E32F] bg-[#98E32F]/5">Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-500/20 text-red-400 bg-red-400/5">Unverified</Badge>
                        )}
                        <span className="text-xs text-white/40 truncate max-w-[150px]">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/40 font-mono text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
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
                          <DropdownMenuItem onClick={() => {}}>
                            <Mail className="mr-2 h-4 w-4" /> Email User
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuLabel className="text-[10px] uppercase text-white/20">Change Role</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => updateRoleMutation.mutate({ id: user._id, role: 'user' })}>
                            <UserCog className="mr-2 h-4 w-4" /> Set as User
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
        </CardContent>
      </Card>
    </div>
  );
}
