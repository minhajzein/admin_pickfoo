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
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  MoreHorizontal, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Trash2
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function RestaurantsPage() {
  const [search, setSearch] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: restaurants, isLoading } = useQuery({
    queryKey: ['restaurants', search],
    queryFn: async () => {
      const response = await api.get(`/restaurants?search=${search}`);
      return response.data.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await api.put(`/restaurants/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      toast.success('Restaurant status updated successfully');
    },
    onError: () => {
      toast.error('Failed to update status');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/80">Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">Pending</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="text-white/40 border-white/10">Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurants</h2>
          <p className="text-white/50 text-sm">Manage and verify restaurant partners</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Search restaurants..."
            className="pl-9 bg-[#002833] border-white/10 text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="bg-[#002833] border-white/5 text-white overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">Restaurant</TableHead>
                <TableHead className="text-white/60">Owner</TableHead>
                <TableHead className="text-white/60">Location</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Joined</TableHead>
                <TableHead className="text-right text-white/60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-[#98E32F]"></div>
                      <span className="text-white/40">Loading restaurants...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : restaurants?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-white/40">
                    No restaurants found
                  </TableCell>
                </TableRow>
              ) : (
                restaurants?.map((restaurant: any) => (
                  <TableRow key={restaurant._id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-xs">
                          {restaurant.name[0]}
                        </div>
                        <div className="flex flex-col">
                          <span>{restaurant.name}</span>
                          <span className="text-[10px] text-white/40">{restaurant.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{restaurant.owner?.name || 'Unknown'}</TableCell>
                    <TableCell>{restaurant.address.city}</TableCell>
                    <TableCell>{getStatusBadge(restaurant.status)}</TableCell>
                    <TableCell className="text-white/40 font-mono text-xs">
                      {new Date(restaurant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-[#98E32F]/10 hover:text-[#98E32F]">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#002833] border-white/5 text-white">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setSelectedRestaurant(restaurant); setIsViewOpen(true); }}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          {restaurant.status !== 'active' && (
                            <DropdownMenuItem 
                              className="text-[#98E32F] focus:text-[#98E32F] focus:bg-[#98E32F]/10"
                              onClick={() => updateStatusMutation.mutate({ id: restaurant._id, status: 'active' })}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                            </DropdownMenuItem>
                          )}
                          {restaurant.status !== 'suspended' && (
                            <DropdownMenuItem 
                              className="text-red-400 focus:text-red-400 focus:bg-red-400/10"
                              onClick={() => updateStatusMutation.mutate({ id: restaurant._id, status: 'suspended' })}
                            >
                              <AlertCircle className="mr-2 h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-500/10">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
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

      {/* Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="bg-[#002833] border-white/5 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{selectedRestaurant?.name}</DialogTitle>
            <DialogDescription className="text-white/40">
              Complete restaurant details and legal documentation
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div>
                <Label className="text-white/40">Business Information</Label>
                <div className="mt-1 space-y-1">
                  <p className="text-sm"><span className="text-white/20 mr-2">Email:</span>{selectedRestaurant?.email}</p>
                  <p className="text-sm"><span className="text-white/20 mr-2">Phone:</span>{selectedRestaurant?.contactNumber}</p>
                  <p className="text-sm"><span className="text-white/20 mr-2">Address:</span>{selectedRestaurant?.address.street}, {selectedRestaurant?.address.city}</p>
                </div>
              </div>
              <div>
                <Label className="text-white/40">Legal IDs</Label>
                <div className="mt-1 space-y-1">
                  <p className="text-sm"><span className="text-white/20 mr-2">FSSAI:</span>{selectedRestaurant?.legalDocs.fssaiLicenseNumber}</p>
                  <p className="text-sm"><span className="text-white/20 mr-2">GST:</span>{selectedRestaurant?.legalDocs.gstNumber || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-white/40">Status History</Label>
                <div className="mt-1 flex items-center gap-2">
                  {getStatusBadge(selectedRestaurant?.status)}
                  <span className="text-[10px] text-white/20 italic">Last updated: Recently</span>
                </div>
              </div>
              {selectedRestaurant?.verificationNotes && (
                <div>
                  <Label className="text-white/40">Notes</Label>
                  <p className="text-sm text-white/70 mt-1 italic">{selectedRestaurant.verificationNotes}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsViewOpen(false)} className="border-white/10 hover:bg-white/5">
              Close
            </Button>
            {selectedRestaurant?.status === 'pending' && (
              <Button 
                className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
                onClick={() => {
                  updateStatusMutation.mutate({ id: selectedRestaurant._id, status: 'active' });
                  setIsViewOpen(false);
                }}
              >
                Approve Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
