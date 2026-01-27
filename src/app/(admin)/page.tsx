'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Store, 
  Users, 
  ClipboardList, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  CheckCircle2
} from 'lucide-react';

export default function AdminDashboard() {
  const stats = [
    {
      title: 'Total Restaurants',
      value: '124',
      change: '+12%',
      isPositive: true,
      icon: Store,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10'
    },
    {
      title: 'Active Users',
      value: '1,280',
      change: '+5.4%',
      isPositive: true,
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10'
    },
    {
      title: 'Total Orders',
      value: '4,520',
      change: '+22.1%',
      isPositive: true,
      icon: ClipboardList,
      color: 'text-[#98E32F]',
      bg: 'bg-[#98E32F]/10'
    },
    {
      title: 'Gross Revenue',
      value: '₹12.4L',
      change: '-2.4%',
      isPositive: false,
      icon: Wallet,
      color: 'text-orange-400',
      bg: 'bg-orange-400/10'
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-white/50">Welcome back, Super Admin. Here's what's happening today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-[#002833] border-white/5 text-white overflow-hidden group hover:border-[#98E32F]/30 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-white/60">{stat.title}</CardTitle>
              <div className={`${stat.bg} ${stat.color} p-2 rounded-lg transition-transform group-hover:scale-110 duration-300`}>
                <stat.icon size={20} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs flex items-center mt-1">
                {stat.isPositive ? (
                  <ArrowUpRight size={14} className="text-[#98E32F] mr-1" />
                ) : (
                  <ArrowDownRight size={14} className="text-red-400 mr-1" />
                )}
                <span className={stat.isPositive ? 'text-[#98E32F]' : 'text-red-400'}>
                  {stat.change}
                </span>
                <span className="text-white/30 ml-1">from last month</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 bg-[#002833] border-white/5 text-white">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    {i % 2 === 0 ? <Clock size={20} className="text-blue-400" /> : <CheckCircle2 size={20} className="text-[#98E32F]" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {i % 2 === 0 ? 'New restaurant application: "The Curry House"' : 'User "Aman Gupta" verified their email'}
                    </p>
                    <p className="text-xs text-white/40">
                      {i * 15} minutes ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-3 bg-[#002833] border-white/5 text-white">
          <CardHeader>
            <CardTitle>Verification Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#98E32F]/20 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center font-bold">
                      {String.fromCharCode(64 + i)}
                    </div>
                    <div>
                      <p className="text-sm font-bold">Restaurant {i}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Pending Review</p>
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                </div>
              ))}
              <button className="w-full py-3 rounded-xl border border-dashed border-white/10 text-white/40 text-sm hover:text-[#98E32F] hover:border-[#98E32F]/40 transition-all">
                View All Pending Requests
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
