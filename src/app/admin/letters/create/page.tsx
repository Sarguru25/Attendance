'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Mail, FileText, CheckCircle, Search, Users, Download } from 'lucide-react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { api } from '@/services/api';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CreateLetterPage() {
  const { data: templatesData, isLoading: templatesLoading } = useSWR('/api/letters/templates', fetcher);
  const { data: employeesData, isLoading: employeesLoading } = useSWR('/api/letters/employees', fetcher);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  const [selectedEmployees, setSelectedEmployees] = useState<any[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  const [useLetterhead, setUseLetterhead] = useState(true);
  const [letterDate, setLetterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [customVariables, setCustomVariables] = useState<Record<string, Record<string, any>>>({}); // { empId: { varName: varValue } }
  const [contentDraft, setContentDraft] = useState('');

  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const templates = templatesData?.templates || [];
  const employees = employeesData?.employees || [];

  const filteredEmployees = employees.filter((emp: any) => 
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.department?.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find((t: any) => t._id === selectedTemplateId);
      setSelectedTemplate(template);
      setContentDraft(template?.content || '');
    } else {
      setSelectedTemplate(null);
      setContentDraft('');
    }
  }, [selectedTemplateId, templates]);

  const toggleEmployeeSelection = (employee: any) => {
    if (selectedEmployees.find(e => e._id === employee._id)) {
      setSelectedEmployees(selectedEmployees.filter(e => e._id !== employee._id));
      if (previewEmployeeId === employee._id) setPreviewEmployeeId(null);
    } else {
      setSelectedEmployees([...selectedEmployees, employee]);
      if (!previewEmployeeId) setPreviewEmployeeId(employee._id);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
      setPreviewEmployeeId(null);
    } else {
      setSelectedEmployees(filteredEmployees);
      if (filteredEmployees.length > 0) setPreviewEmployeeId(filteredEmployees[0]._id);
    }
    setSelectAll(!selectAll);
  };

  const updateCustomVariable = (empId: string, varName: string, value: any) => {
    setCustomVariables(prev => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || {}),
        [varName]: value
      }
    }));
  };

  const generatePreviewHTML = (employeeId: string) => {
    if (!selectedTemplate || !contentDraft) return '';
    
    const emp = employees.find((e: any) => e._id === employeeId);
    if (!emp) return '';

    let html = contentDraft;

    // Replace standard placeholders
    const standardPlaceholders: Record<string, string> = {
      '{{employeeName}}': emp.name,
      '{{employeeCode}}': emp.employeeId,
      '{{designation}}': emp.designation,
      '{{department}}': emp.department,
      '{{email}}': emp.email,
      '{{currentDate}}': format(new Date(letterDate), 'dd/MM/yyyy'),
      '{{companyName}}': 'Your Company Name', // Could be fetched from settings
    };

    Object.keys(standardPlaceholders).forEach(key => {
      html = html.replace(new RegExp(key, 'g'), standardPlaceholders[key] || '');
    });

    // Replace custom variables
    const empVars = customVariables[emp._id] || {};
    selectedTemplate.customVariables?.forEach((cv: any) => {
      const regex = new RegExp(`{{${cv.name}}}`, 'g');
      html = html.replace(regex, empVars[cv.name] || `[${cv.name}]`);
    });

    return html;
  };

  const handleDownloadPreview = () => {
    if (!previewEmployeeId || !selectedTemplate) {
      return toast.error('Please select a template and an employee to preview');
    }

    const emp = employees.find((e: any) => e._id === previewEmployeeId);
    let html = generatePreviewHTML(previewEmployeeId);
    if (!html) return toast.error('No letter content to preview');

    if (useLetterhead) {
      html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          ${html}
        </div>
      `;
    } else {
      html = `<div style="font-family: Arial, sans-serif; padding: 20px;">${html}</div>`;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Preview - ${emp?.name || 'Employee Letter'}</title>
            <style>
              @font-face {
                font-family: "Allura";
                src: url("/font/Allura/Allura-Regular.ttf") format("truetype");
              }
              body {
                background-color: #ffffff;
                font-size: 16px;
                text-align: justify;
                font-family: Helvetica, Arial, sans-serif;
                line-height: 1.5;
                margin: 0;
                padding: 20px;
              }
              @media print {
                @page {
                  size: A4;
                  margin: 0;
                }
              }
            </style>
          </head>
          <body onload="setTimeout(() => window.print(), 500)">
            ${html}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleBulkSend = async () => {
    if (!selectedTemplate) return toast.error('Please select a template');
    if (selectedEmployees.length === 0) return toast.error('Please select at least one employee');
    
    // Check if required variables are filled
    let hasMissingVars = false;
    selectedEmployees.forEach(emp => {
      selectedTemplate.customVariables?.forEach((cv: any) => {
        if (!customVariables[emp._id]?.[cv.name]) {
          hasMissingVars = true;
        }
      });
    });

    if (hasMissingVars) {
      return toast.error('Please fill all custom variables for selected employees');
    }

    setIsSending(true);
    const toastId = toast.loading('Generating and sending letters...');

    try {
      const payload = {
        templateId: selectedTemplate._id,
        employeesData: selectedEmployees.map(emp => {
          let html = generatePreviewHTML(emp._id);
          if (useLetterhead) {
             html = `
               <div style="font-family: Arial, sans-serif; padding: 20px;">
                 ${html}
               </div>
             `;
          } else {
             html = `<div style="font-family: Arial, sans-serif; padding: 20px;">${html}</div>`;
          }

          return {
            employeeId: emp._id,
            email: emp.email,
            name: emp.name,
            htmlContent: html,
            variables: customVariables[emp._id] || {},
          };
        }),
      };

      const res = await api('/api/letters/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Letters sent successfully', { id: toastId });
        // Optional: clear form
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to send letters', { id: toastId });
      }
    } catch (error: any) {
      toast.error('An error occurred', { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      {/* LEFT PANEL */}
      <div className="w-1/2 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
        {/* Template Selection */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold tracking-tight text-card-foreground mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-primary" />
            Letter Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-card-foreground mb-1">Select Template</label>
              <select
                className="w-full bg-background border border-border text-foreground font-bold rounded-xl px-4 py-2 min-h-[44px] focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">-- Choose a Template --</option>
                {templates.map((t: any) => (
                  <option key={t._id} value={t._id}>{t.templateName} ({t.category})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-card-foreground mb-1">Date on Letter</label>
                <input
                  type="date"
                  className="w-full bg-background border border-border text-foreground font-bold rounded-xl px-4 py-2 min-h-[44px] outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center text-sm font-bold text-card-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-2 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background h-4 w-4"
                    checked={useLetterhead}
                    onChange={(e) => setUseLetterhead(e.target.checked)}
                  />
                  Include Letterhead
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Selection */}
        {selectedTemplate && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex-1 flex flex-col min-h-[300px]">
            <h2 className="text-lg font-bold tracking-tight text-card-foreground mb-4 flex items-center justify-between">
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-primary" />
                Select Employees
              </div>
              <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-1 rounded-full">
                {selectedEmployees.length} selected
              </span>
            </h2>
            
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search by name or department..."
                className="w-full bg-background border border-border text-foreground font-bold rounded-xl pl-10 pr-4 py-2 min-h-[44px] outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between mb-2 px-2">
              <label className="flex items-center text-sm font-bold text-card-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="mr-2 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-background h-4 w-4"
                  checked={selectAll}
                  onChange={handleSelectAll}
                />
                Select All Filtered
              </label>
            </div>

            <div className="flex-1 overflow-y-auto border border-border rounded-xl bg-muted/30">
              {employeesLoading ? (
                <div className="p-4 text-center text-muted-foreground font-bold text-sm">Loading employees...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground font-bold text-sm">No employees found</div>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredEmployees.map((emp: any) => (
                    <li key={emp._id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center min-w-0">
                        <input
                          type="checkbox"
                          className="mr-3 rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
                          checked={!!selectedEmployees.find(e => e._id === emp._id)}
                          onChange={() => toggleEmployeeSelection(emp)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-card-foreground truncate">{emp.name}</p>
                          <p className="text-xs font-bold text-muted-foreground truncate">{emp.designation} • {emp.department}</p>
                        </div>
                      </div>
                      {selectedEmployees.find(e => e._id === emp._id) && previewEmployeeId !== emp._id && (
                        <button
                          onClick={() => setPreviewEmployeeId(emp._id)}
                          className="text-xs font-bold text-primary hover:text-primary/80 ml-2"
                        >
                          Preview
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Variables Form */}
        {selectedTemplate && selectedEmployees.length > 0 && selectedTemplate.customVariables?.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-card-foreground mb-4">Set Variable Values</h2>
            <div className="space-y-6">
              {selectedEmployees.map((emp) => (
                <div key={emp._id} className="bg-muted/30 p-4 rounded-xl border border-border">
                  <h3 className="text-sm font-bold text-card-foreground mb-3 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-primary mr-2"></span>
                    {emp.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedTemplate.customVariables.map((cv: any) => (
                      <div key={cv.name}>
                        <label className="block text-xs font-bold text-card-foreground mb-1">{cv.name} ({cv.type})</label>
                        <input
                          type={cv.type === 'Number' ? 'number' : cv.type === 'Date' ? 'date' : 'text'}
                          className="w-full bg-background border border-border text-foreground font-bold rounded-xl px-3 py-2 min-h-[44px] text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                          value={customVariables[emp._id]?.[cv.name] || ''}
                          onChange={(e) => updateCustomVariable(emp._id, cv.name, e.target.value)}
                          placeholder={`Enter ${cv.name}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* RIGHT PANEL - LIVE PREVIEW */}
      <div className="w-1/2 flex flex-col bg-white rounded-xl shadow-lg border border-neutral-200 overflow-hidden relative">
        <div className="bg-neutral-100 border-b border-neutral-200 p-3 flex justify-between items-center z-10">
          <div className="flex items-center">
            <span className="text-sm font-medium text-neutral-700">Live Preview</span>
            {previewEmployeeId && (
              <span className="ml-3 text-xs bg-white px-2 py-1 rounded border border-neutral-200 text-neutral-600">
                Viewing: {employees.find((e: any) => e._id === previewEmployeeId)?.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPreview}
              disabled={!previewEmployeeId || !selectedTemplate}
              className="flex items-center px-3 py-2 bg-white text-neutral-800 text-sm font-bold rounded-xl min-h-[44px] border border-neutral-300 shadow-sm hover:bg-neutral-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Download & verify letter before sending"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Preview
            </button>
            <button
              type="button"
              onClick={handleBulkSend}
              disabled={isSending || selectedEmployees.length === 0}
              className="flex items-center px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl min-h-[44px] shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <Mail className="w-4 h-4 mr-2" />
              {isSending ? 'Processing...' : `Send to ${selectedEmployees.length}`}
            </button>
          </div>
        </div>
        
        <div className="flex-1 p-8 overflow-y-auto bg-[#525659]">
          {!selectedTemplate ? (
            <div className="h-full flex items-center justify-center text-neutral-400 font-medium">
              Select a template to view preview
            </div>
          ) : !previewEmployeeId ? (
            <div className="h-full flex items-center justify-center text-neutral-400 font-medium">
              Select an employee to view preview
            </div>
          ) : (
            <div className="max-w-3xl mx-auto bg-white shadow-2xl rounded p-12 min-h-[842px] relative">
               <div 
                 className="prose max-w-none text-neutral-800"
                 dangerouslySetInnerHTML={{ __html: generatePreviewHTML(previewEmployeeId) }}
               />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
