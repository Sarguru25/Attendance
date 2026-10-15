'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Building2, Plus, Edit2, Loader2, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { format } from 'date-fns';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DEFAULT_LOGOS = [
  { name: 'truflow', filename: 'truflow.png', path: '/logo/truflow.png' },
  { name: 'zeetork', filename: 'zeetork.png', path: '/logo/zeetork.png' },
];

export default function CompaniesPage() {
  const { data, mutate, isLoading } = useSWR('/api/admin/companies', fetcher);
  const { data: logosData } = useSWR('/api/admin/companies/logos', fetcher);

  const availableLogos = logosData?.logos?.length ? logosData.logos : DEFAULT_LOGOS;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    companyCode: '',
    email: '',
    phone: '',
    address: '',
    logo: '',
    status: true,
  });

  const openModal = (company: any = null) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        companyName: company.companyName || '',
        companyCode: company.companyCode || '',
        email: company.email || '',
        phone: company.phone || '',
        address: company.address || '',
        logo: company.logo || '',
        status: company.status ?? true,
      });
    } else {
      setEditingCompany(null);
      setFormData({
        companyName: '',
        companyCode: '',
        email: '',
        phone: '',
        address: '',
        logo: availableLogos[0]?.path || '/logo/truflow.png',
        status: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = editingCompany ? `/api/admin/companies/${editingCompany._id}` : '/api/admin/companies';
      const method = editingCompany ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create company');
      }

      await mutate();
      setIsModalOpen(false);
      setFormData({
        companyName: '',
        companyCode: '',
        email: '',
        phone: '',
        address: '',
        logo: '',
        status: true,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Company Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage multiple organizations, logos, and branch addresses</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl min-h-[44px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus className="w-4 h-4" />
          Add Company
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-card-foreground">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold">Company</th>
                <th className="px-6 py-4 font-bold">Code</th>
                <th className="px-6 py-4 font-bold">Contact</th>
                <th className="px-6 py-4 font-bold">Address</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Added On</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground font-bold">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : data?.companies?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground font-bold">
                    No companies found. Create one to get started.
                  </td>
                </tr>
              ) : (
                data?.companies?.map((company: any) => (
                  <tr key={company._id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {company.logo ? (
                          <div className="w-12 h-9 rounded-md bg-white border border-border flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={company.logo} alt="" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-12 h-9 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border shrink-0">
                            {company.companyCode}
                          </div>
                        )}
                        <span className="font-bold text-card-foreground">{company.companyName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-muted-foreground">{company.companyCode}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-card-foreground">{company.email}</div>
                      <div className="text-xs font-bold text-muted-foreground">{company.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      {company.address ? (
                        <div className="text-xs text-muted-foreground line-clamp-2" title={company.address}>
                          {company.address}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No address set</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {company.status ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-success/10 text-success">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-destructive/10 text-destructive">
                          <XCircle className="w-3.5 h-3.5" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-muted-foreground">
                      {company.createdAt ? format(new Date(company.createdAt), 'MMM d, yyyy') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => openModal(company)} 
                        className="p-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        title="Edit Company"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-3">
              <h3 className="text-lg font-bold text-card-foreground">{editingCompany ? 'Edit Company' : 'Add New Company'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-card-foreground mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  placeholder="e.g. Truflow Solutions Private Limited"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-1">Company Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.companyCode}
                    onChange={(e) => setFormData({ ...formData, companyCode: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="e.g. TRUFLOW"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-card-foreground mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-card-foreground mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  placeholder="contact@company.com"
                />
              </div>

              {/* Company Address Field */}
              <div>
                <label className="block text-sm font-bold text-card-foreground mb-1 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" />
                  Company Address (Used in Payslip)
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm"
                  placeholder="e.g. S.F.No.617/2H2, Vadakku Thottam, L&T Road, Malumichampatti, Coimbatore, Tamil Nadu-641050"
                />
              </div>

              {/* Logo Selection Dropdown from public/logo */}
              <div>
                <label className="block text-sm font-bold text-card-foreground mb-1">
                  Company Logo (From public/logo)
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="">No logo</option>
                    {availableLogos.map((l: any) => (
                      <option key={l.path} value={l.path}>
                        {l.filename || l.name} ({l.path})
                      </option>
                    ))}
                  </select>

                  {formData.logo ? (
                    <div className="w-20 h-11 rounded-lg border border-border bg-white flex items-center justify-center p-1 shrink-0 shadow-sm overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formData.logo}
                        alt="Logo preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-11 rounded-lg border border-dashed border-border bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                      No Logo
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Logos are populated from the <code className="text-xs bg-muted px-1 py-0.5 rounded">public/logo</code> directory.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="status"
                  checked={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                  className="w-4 h-4 bg-background border-border rounded text-primary focus:ring-primary focus:ring-offset-background"
                />
                <label htmlFor="status" className="text-sm font-bold text-card-foreground">
                  Active (Employees can be assigned)
                </label>
              </div>

              <div className="pt-4 flex gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl min-h-[44px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl min-h-[44px] font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : editingCompany ? 'Save Changes' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

