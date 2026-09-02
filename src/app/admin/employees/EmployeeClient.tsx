'use client';

import React, { useState, useRef } from 'react';
import { Plus, Search, Edit, Trash2, X, Loader2, Camera, User as UserIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';

export default function EmployeeClient({ initialEmployees, shifts }: { initialEmployees: any[], shifts: any[] }) {
  const router = useRouter();
  const [employees, setEmployees] = useState(initialEmployees);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'employees' | 'leaves'>('employees');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const [balanceForm, setBalanceForm] = useState({
    casualLeave: 0,
    sickLeave: 0,
    restrictedLeave: 0,
    compensatoryOff: 0
  });
  

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    password: '',
    phoneNumber: '',
    department: '',
    designation: '',
    shiftId: shifts.length > 0 ? shifts[0]._id : '',
    joiningDate: new Date().toISOString().split('T')[0],
    isActive: true,
    profileImage: '',
    gender: '',
    role: 'employee',
  });

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(search.toLowerCase()) || 
    emp.employeeId.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase())
  );

  const openModal = (employee: any = null) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        password: '',
        phoneNumber: employee.phoneNumber || '',
        department: employee.department,
        designation: employee.designation,
        shiftId: employee.shiftId?._id || employee.shiftId || (shifts.length > 0 ? shifts[0]._id : ''),
        joiningDate: new Date(employee.joiningDate).toISOString().split('T')[0],
        isActive: employee.isActive,
        profileImage: employee.profileImage || '',
        gender: employee.gender || '',
        role: employee.role || 'employee',
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        employeeId: '',
        name: '',
        email: '',
        password: '',
        phoneNumber: '',
        department: '',
        designation: '',
        shiftId: shifts.length > 0 ? shifts[0]._id : '',
        joiningDate: new Date().toISOString().split('T')[0],
        isActive: true,
        profileImage: '',
        gender: '',
        role: 'employee',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profileImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = editingEmployee 
        ? `/api/admin/employees/${editingEmployee._id}` 
        : '/api/admin/employees';
        
      const method = editingEmployee ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Something went wrong');
        setIsLoading(false);
        return;
      }

      router.refresh(); 
      window.location.reload();
      
    } catch (error) {
      console.error(error);
      alert('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    
    try {
      const response = await api(`/api/admin/employees/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to delete');
        return;
      }
      
      setEmployees(employees.filter(emp => emp._id !== id));
      router.refresh();
    } catch (error) {
      console.error(error);
      alert('An error occurred');
    }
  };

  const handleEditBalance = (employee: any) => {
    setEditingBalanceId(employee._id);
    setBalanceForm({
      casualLeave: employee.leaveBalance.casualLeave.available,
      sickLeave: employee.leaveBalance.sickLeave.available,
      restrictedLeave: employee.leaveBalance.restrictedLeave.available,
      compensatoryOff: employee.leaveBalance.compensatoryOff.available,
    });
  };

  const handleSaveBalance = async (employeeId: string) => {
    setIsSavingBalance(true);
    try {
      const response = await api(`/api/admin/employees/${employeeId}/leave-balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(balanceForm),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to update balance');
        return;
      }

      const updatedEmployees = employees.map(emp => {
        if (emp._id === employeeId) {
          return {
            ...emp,
            leaveBalance: {
              ...emp.leaveBalance,
              casualLeave: { ...emp.leaveBalance.casualLeave, available: balanceForm.casualLeave },
              sickLeave: { ...emp.leaveBalance.sickLeave, available: balanceForm.sickLeave },
              restrictedLeave: { ...emp.leaveBalance.restrictedLeave, available: balanceForm.restrictedLeave },
              compensatoryOff: { ...emp.leaveBalance.compensatoryOff, available: balanceForm.compensatoryOff },
            }
          };
        }
        return emp;
      });
      setEmployees(updatedEmployees);
      setEditingBalanceId(null);
    } catch (error) {
      console.error(error);
      alert('An error occurred');
    } finally {
      setIsSavingBalance(false);
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your workforce here.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="w-full sm:w-auto flex justify-center items-center px-4 py-2 min-h-[44px] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </button>
      </div>

      <div className="flex border-b border-border overflow-x-auto scrollbar-hide bg-card rounded-t-2xl px-4 pt-2">
        <button 
          className={`px-6 py-3 whitespace-nowrap text-sm font-bold transition-colors ${activeTab === 'employees' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('employees')}
        >
          Employees Directory
        </button>
        <button 
          className={`px-6 py-3 whitespace-nowrap text-sm font-bold transition-colors ${activeTab === 'leaves' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('leaves')}
        >
          Leave Balances
        </button>
      </div>

      <div className="bg-card border-x border-b border-border rounded-b-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 min-h-[44px] border border-border rounded-xl leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
              placeholder={activeTab === 'employees' ? "Search employees..." : "Search by name or ID..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {activeTab === 'employees' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/30">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Employee
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Employee ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Department
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Shift
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground font-bold">
                    No employees found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <React.Fragment key={employee._id}>
                  <tr className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setExpandedRowId(expandedRowId === employee._id ? null : employee._id)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-bold overflow-hidden">
                          {employee.profileImage ? (
                            <img src={employee.profileImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            employee.name.charAt(0)
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-card-foreground">{employee.name}</div>
                          <div className="text-sm text-muted-foreground">{employee.email}</div>
                          {employee.phoneNumber && <div className="text-xs text-muted-foreground">{employee.phoneNumber}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-card-foreground">{employee.employeeId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-card-foreground">{employee.department}</div>
                      <div className="text-xs text-muted-foreground">
                        {employee.designation}
                        {employee.role && employee.role !== 'employee' && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-muted text-muted-foreground capitalize border border-border">
                            {employee.role.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                        {employee.shiftId ? employee.shiftId.shiftName : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employee.isActive ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-bold rounded-full bg-success/10 text-success border border-success/20">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-bold rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openModal(employee); }}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(employee._id); }}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button 
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                          {expandedRowId === employee._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedRowId === employee._id && employee.leaveBalance && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-bold text-card-foreground">Leave Balance</h4>
                          {editingBalanceId === employee._id ? (
                            <div className="flex gap-2">
                              <button onClick={() => setEditingBalanceId(null)} className="px-4 py-2 min-h-[44px] text-xs font-bold text-muted-foreground hover:text-foreground transition-colors border border-border rounded-xl">Cancel</button>
                              <button onClick={() => handleSaveBalance(employee._id)} disabled={isSavingBalance} className="px-4 py-2 min-h-[44px] text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                {isSavingBalance ? 'Saving...' : 'Save Balance'}
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => handleEditBalance(employee)} className="text-xs font-bold flex items-center text-primary hover:text-primary/80 transition-colors">
                              <Edit className="w-3 h-3 mr-1" /> Edit Balance
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="bg-background border border-border p-3 rounded-xl flex flex-col justify-between">
                            <div className="text-xs font-bold text-muted-foreground mb-2">Casual Leave</div>
                            <div className="flex justify-between items-end">
                              {editingBalanceId === employee._id ? (
                                <input type="number" min="0" step="0.5" className="w-16 bg-muted border border-border rounded-xl text-foreground px-2 py-1 min-h-[44px] text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={balanceForm.casualLeave} onChange={e => setBalanceForm({...balanceForm, casualLeave: Number(e.target.value)})} />
                              ) : (
                                <span className="text-lg font-bold text-card-foreground">
                                  {employee.leaveBalance.casualLeave.available} <span className="text-[10px] text-muted-foreground font-normal">avail</span>
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{employee.leaveBalance.casualLeave.taken} booked</span>
                            </div>
                          </div>
                          <div className="bg-background border border-border p-3 rounded-xl flex flex-col justify-between">
                            <div className="text-xs font-bold text-muted-foreground mb-2">Sick Leave</div>
                            <div className="flex justify-between items-end">
                              {editingBalanceId === employee._id ? (
                                <input type="number" min="0" step="0.5" className="w-16 bg-muted border border-border rounded-xl text-foreground px-2 py-1 min-h-[44px] text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={balanceForm.sickLeave} onChange={e => setBalanceForm({...balanceForm, sickLeave: Number(e.target.value)})} />
                              ) : (
                                <span className="text-lg font-bold text-card-foreground">
                                  {employee.leaveBalance.sickLeave.available} <span className="text-[10px] text-muted-foreground font-normal">avail</span>
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{employee.leaveBalance.sickLeave.taken} booked</span>
                            </div>
                          </div>
                          <div className="bg-background border border-border p-3 rounded-xl flex flex-col justify-between">
                            <div className="text-xs font-bold text-muted-foreground mb-2">Restricted Holiday</div>
                            <div className="flex justify-between items-end">
                              {editingBalanceId === employee._id ? (
                                <input type="number" min="0" step="0.5" className="w-16 bg-muted border border-border rounded-xl text-foreground px-2 py-1 min-h-[44px] text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={balanceForm.restrictedLeave} onChange={e => setBalanceForm({...balanceForm, restrictedLeave: Number(e.target.value)})} />
                              ) : (
                                <span className="text-lg font-bold text-card-foreground">
                                  {employee.leaveBalance.restrictedLeave.available} <span className="text-[10px] text-muted-foreground font-normal">avail</span>
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{employee.leaveBalance.restrictedLeave.taken} booked</span>
                            </div>
                          </div>
                          <div className="bg-background border border-border p-3 rounded-xl flex flex-col justify-between">
                            <div className="text-xs font-bold text-muted-foreground mb-2">Compensatory Off</div>
                            <div className="flex justify-between items-end">
                              {editingBalanceId === employee._id ? (
                                <input type="number" min="0" step="0.5" className="w-16 bg-muted border border-border rounded-xl text-foreground px-2 py-1 min-h-[44px] text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={balanceForm.compensatoryOff} onChange={e => setBalanceForm({...balanceForm, compensatoryOff: Number(e.target.value)})} />
                              ) : (
                                <span className="text-lg font-bold text-card-foreground">
                                  {employee.leaveBalance.compensatoryOff.available} <span className="text-[10px] text-muted-foreground font-normal">avail</span>
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">{employee.leaveBalance.compensatoryOff.taken} booked</span>
                            </div>
                          </div>
                          <div className="bg-background border border-border p-3 rounded-xl flex flex-col justify-between">
                            <div className="text-xs font-bold text-muted-foreground mb-2">Leave Without Pay</div>
                            <div className="flex justify-end items-end h-full pb-1">
                              <span className="text-xs text-muted-foreground">{employee.leaveBalance.leaveWithoutPay.taken} booked</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}

        {activeTab === 'leaves' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/30">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Employee
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Casual Leave
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Sick Leave
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Restricted Leave
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Compensatory Off
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Leave Without Pay
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground font-bold">
                    No employees found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => {
                  const isEditing = editingBalanceId === employee._id;
                  
                  return (
                  <tr key={employee._id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground font-bold overflow-hidden">
                          {employee.profileImage ? (
                            <img src={employee.profileImage} alt="" className="h-full w-full object-cover" />
                          ) : (
                            employee.name.charAt(0)
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-card-foreground">{employee.name}</div>
                          <div className="text-xs text-muted-foreground">{employee.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {isEditing ? (
                        <input type="number" min="0" step="0.5" className="w-16 mx-auto bg-background border border-border rounded-xl text-foreground px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={balanceForm.casualLeave} onChange={e => setBalanceForm({...balanceForm, casualLeave: Number(e.target.value)})} />
                      ) : (
                        <div>
                          <div className="text-sm font-bold text-card-foreground">{employee.leaveBalance?.casualLeave?.available || 0} <span className="text-[10px] text-muted-foreground font-normal">avail</span></div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{employee.leaveBalance?.casualLeave?.taken || 0} taken</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {isEditing ? (
                        <input type="number" min="0" step="0.5" className="w-16 mx-auto bg-background border border-border rounded-xl text-foreground px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={balanceForm.sickLeave} onChange={e => setBalanceForm({...balanceForm, sickLeave: Number(e.target.value)})} />
                      ) : (
                        <div>
                          <div className="text-sm font-bold text-card-foreground">{employee.leaveBalance?.sickLeave?.available || 0} <span className="text-[10px] text-muted-foreground font-normal">avail</span></div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{employee.leaveBalance?.sickLeave?.taken || 0} taken</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {isEditing ? (
                        <input type="number" min="0" step="0.5" className="w-16 mx-auto bg-background border border-border rounded-xl text-foreground px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={balanceForm.restrictedLeave} onChange={e => setBalanceForm({...balanceForm, restrictedLeave: Number(e.target.value)})} />
                      ) : (
                        <div>
                          <div className="text-sm font-bold text-card-foreground">{employee.leaveBalance?.restrictedLeave?.available || 0} <span className="text-[10px] text-muted-foreground font-normal">avail</span></div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{employee.leaveBalance?.restrictedLeave?.taken || 0} taken</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {isEditing ? (
                        <input type="number" min="0" step="0.5" className="w-16 mx-auto bg-background border border-border rounded-xl text-foreground px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" value={balanceForm.compensatoryOff} onChange={e => setBalanceForm({...balanceForm, compensatoryOff: Number(e.target.value)})} />
                      ) : (
                        <div>
                          <div className="text-sm font-bold text-card-foreground">{employee.leaveBalance?.compensatoryOff?.available || 0} <span className="text-[10px] text-muted-foreground font-normal">avail</span></div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{employee.leaveBalance?.compensatoryOff?.taken || 0} taken</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{employee.leaveBalance?.leaveWithoutPay?.taken || 0} taken</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                      {isEditing ? (
                        <div className="flex flex-col gap-1 items-end">
                          <button onClick={() => handleSaveBalance(employee._id)} disabled={isSavingBalance} className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50">
                            {isSavingBalance ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={() => setEditingBalanceId(null)} className="text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-lg">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleEditBalance(employee)}
                          className="text-primary hover:text-primary/80 transition-colors p-2 bg-primary/10 rounded-lg flex items-center ml-auto"
                        >
                          <Edit className="h-4 w-4 mr-1.5" /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-black/80 backdrop-blur-sm z-0" onClick={closeModal} />

            <div className="relative z-10 inline-block w-full max-w-2xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-card border border-border rounded-2xl shadow-xl sm:my-8 sm:align-middle sm:p-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-5 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-card-foreground">
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </h3>
                <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-center mb-6">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="h-20 w-20 rounded-full border-2 border-border bg-muted overflow-hidden flex items-center justify-center">
                      {formData.profileImage ? (
                        <img src={formData.profileImage} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-5 w-5 text-card-foreground" />
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Employee ID</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.employeeId}
                      onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">
                      Password {editingEmployee && <span className="text-muted-foreground font-normal text-xs">(Leave blank to keep current)</span>}
                    </label>
                    <input
                      type="password"
                      required={!editingEmployee}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Gender</label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Role</label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      required
                    >
                      <option value="employee">Employee</option>
                      <option value="intern">Intern</option>
                      <option value="team_head">Team Head</option>
                      <option value="manager">Manager</option>
                      <option value="department_head">Department Head</option>
                      <option value="director">Director</option>
                      <option value="admin">Admin</option>
                      <option value="company_admin">Company Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Department</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Designation</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.designation}
                      onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Shift</label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.shiftId}
                      onChange={(e) => setFormData({...formData, shiftId: e.target.value})}
                      required
                    >
                      <option value="">Select a shift</option>
                      {shifts.map(s => (
                        <option key={s._id} value={s._id}>{s.shiftName} ({s.startTime} - {s.endTime})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-card-foreground mb-1.5">Joining Date</label>
                    <input
                      type="date"
                      required
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl min-h-[44px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={formData.joiningDate}
                      onChange={(e) => setFormData({...formData, joiningDate: e.target.value})}
                    />
                  </div>

                  <div className="flex items-center mt-6">
                    <input
                      type="checkbox"
                      id="isActive"
                      className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    />
                    <label htmlFor="isActive" className="ml-2 block text-sm font-bold text-card-foreground">
                      Active Employee
                    </label>
                  </div>
                </div>

                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse border-t border-border pt-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 min-h-[44px] bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Employee'}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="mt-3 w-full inline-flex justify-center rounded-xl border border-border shadow-sm px-4 py-2 min-h-[44px] bg-secondary text-base font-bold text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
