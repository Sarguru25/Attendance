
```
attendance
├─ README.md
├─ letters
│  ├─ Internship_completion_letter.html
│  ├─ bonus_letter.html
│  ├─ emp_comfirmation_with_salary_hike.html
│  ├─ emp_comfirmation_without_salary_hike.html
│  ├─ salary_increment_letter.html
│  ├─ seal-TF.png
│  ├─ seal-ZT.png
│  └─ seal.png
├─ next.config.ts
├─ package-lock.json
├─ package.json
├─ postcss.config.mjs
├─ public
│  ├─ TF.png
│  ├─ TF_logo.png
│  ├─ ZT_logo.png
│  ├─ firebase-messaging-sw.js
│  ├─ font
│  │  ├─ Allura
│  │  │  ├─ Allura-Regular.ttf
│  │  │  └─ OFL.txt
│  │  └─ baguet-script
│  │     ├─ Melvastype - Baguet Script Bold Italic.otf
│  │     ├─ Melvastype - Baguet Script Bold.otf
│  │     ├─ Melvastype - Baguet Script Italic.otf
│  │     ├─ Melvastype - Baguet Script Regular.otf
│  │     ├─ Melvastype - Baguet Script Thin Italic.otf
│  │     └─ Melvastype - Baguet Script Thin.otf
│  ├─ logo
│  │  ├─ truflow.png
│  │  └─ zeetork.png
│  ├─ manifest.webmanifest
│  ├─ policy
│  │  ├─ ADMINISTRATION POLICY.pdf
│  │  ├─ ATTENDANCE POLICY.pdf
│  │  ├─ EMPLOYEE EXIT PROCEDURE.pdf
│  │  ├─ EMPLOYEE JOINING PROCEDURE.pdf
│  │  ├─ EMPLOYEE TRAVEL POLICY.pdf
│  │  └─ OFFICE VEHICLE USAGE.pdf
│  ├─ seal-TF.png
│  └─ seal-ZT.png
├─ resources
│  └─ logo.png
├─ scripts
│  ├─ analyze_and_correct_attendance.ts
│  ├─ employee_data.txt
│  ├─ firebase.txt
│  ├─ inspect_records.ts
│  ├─ migrate_sessions.ts
│  ├─ recover_attendance_hours.ts
│  ├─ seed
│  │  └─ seed.js
│  ├─ test_attendance_permissions.ts
│  ├─ transfer_employee_company.ts
│  └─ workdrive_file_upload.js
├─ src
│  ├─ app
│  │  ├─ admin
│  │  │  ├─ approvals
│  │  │  │  ├─ AdminApprovalClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ attendance
│  │  │  │  ├─ AttendanceClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ calendar
│  │  │  │  ├─ AttendanceCalendar.tsx
│  │  │  │  ├─ bulk-upload
│  │  │  │  └─ page.tsx
│  │  │  ├─ companies
│  │  │  │  └─ page.tsx
│  │  │  ├─ dashboard
│  │  │  │  ├─ DashboardActions.tsx
│  │  │  │  ├─ DashboardClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ employees
│  │  │  │  ├─ EmployeeClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ layout.tsx
│  │  │  ├─ leaves
│  │  │  │  ├─ LeavesClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ letters
│  │  │  │  ├─ create
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ layout.tsx
│  │  │  │  ├─ logs
│  │  │  │  │  └─ page.tsx
│  │  │  │  ├─ sent
│  │  │  │  │  └─ page.tsx
│  │  │  │  └─ templates
│  │  │  │     └─ page.tsx
│  │  │  ├─ organization
│  │  │  │  ├─ HierarchyBuilderClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ payroll
│  │  │  │  ├─ BonusHistoryManager.tsx
│  │  │  │  ├─ PayrollClient.tsx
│  │  │  │  ├─ SalaryConfigurator.tsx
│  │  │  │  ├─ SalaryTimelineManager.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ permissions
│  │  │  │  ├─ AdminPermissionClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ profile
│  │  │  │  └─ page.tsx
│  │  │  ├─ reports
│  │  │  │  ├─ ReportsClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ settings
│  │  │  │  ├─ CalendarClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  └─ shifts
│  │  │     ├─ ShiftsClient.tsx
│  │  │     └─ page.tsx
│  │  ├─ api
│  │  │  ├─ admin
│  │  │  │  ├─ approvals
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ attendance
│  │  │  │  │  ├─ [id]
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  ├─ bulk-import
│  │  │  │  │  │  ├─ [importId]
│  │  │  │  │  │  │  ├─ confirm
│  │  │  │  │  │  │  └─ undo
│  │  │  │  │  │  ├─ template
│  │  │  │  │  │  └─ upload
│  │  │  │  │  ├─ bulk-manual
│  │  │  │  │  ├─ override
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ calendar
│  │  │  │  │  └─ export
│  │  │  │  │     └─ route.ts
│  │  │  │  ├─ companies
│  │  │  │  │  ├─ [id]
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  ├─ logos
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ dashboard
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ employees
│  │  │  │  │  ├─ [id]
│  │  │  │  │  │  ├─ leave-balance
│  │  │  │  │  │  │  └─ route.ts
│  │  │  │  │  │  ├─ route.ts
│  │  │  │  │  │  ├─ salary-deductions
│  │  │  │  │  │  │  └─ route.ts
│  │  │  │  │  │  └─ salary-timelines
│  │  │  │  │  │     └─ route.ts
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ holidays
│  │  │  │  │  ├─ [id]
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ leaves
│  │  │  │  │  ├─ [id]
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ payroll
│  │  │  │  │  ├─ bonus-history
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  ├─ lock
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  ├─ payslip
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  ├─ route.ts
│  │  │  │  │  ├─ salaries
│  │  │  │  │  │  ├─ [id]
│  │  │  │  │  │  │  └─ route.ts
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  └─ send-email
│  │  │  │  │     └─ route.ts
│  │  │  │  ├─ permissions
│  │  │  │  │  ├─ [id]
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  ├─ reports
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ reports
│  │  │  │     ├─ attendance
│  │  │  │     │  ├─ daily
│  │  │  │     │  └─ matrix
│  │  │  │     └─ route.ts
│  │  │  ├─ approvals
│  │  │  │  ├─ action
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ route.ts
│  │  │  ├─ attendance
│  │  │  │  ├─ check-in
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ check-out
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ reminder
│  │  │  │     └─ route.ts
│  │  │  ├─ auth
│  │  │  │  ├─ [...nextauth]
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ status
│  │  │  │     └─ route.ts
│  │  │  ├─ calendar
│  │  │  │  └─ route.ts
│  │  │  ├─ companies
│  │  │  │  ├─ route.ts
│  │  │  │  └─ switch
│  │  │  │     └─ route.ts
│  │  │  ├─ cron
│  │  │  │  └─ attendance
│  │  │  │     └─ route.ts
│  │  │  ├─ employee
│  │  │  │  ├─ attendance
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ dashboard
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ leaves
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ letters
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ my-team
│  │  │  │  │  ├─ [id]
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ payslips
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ permissions
│  │  │  │     ├─ [id]
│  │  │  │     │  └─ compensate
│  │  │  │     │     └─ route.ts
│  │  │  │     ├─ attendance-for-compensation
│  │  │  │     │  └─ route.ts
│  │  │  │     ├─ balance
│  │  │  │     │  └─ route.ts
│  │  │  │     └─ route.ts
│  │  │  ├─ hierarchy
│  │  │  │  ├─ reporting-chain
│  │  │  │  │  └─ [employeeId]
│  │  │  │  │     └─ route.ts
│  │  │  │  ├─ subordinates
│  │  │  │  │  └─ [employeeId]
│  │  │  │  │     └─ route.ts
│  │  │  │  ├─ team
│  │  │  │  │  └─ [managerId]
│  │  │  │  │     └─ route.ts
│  │  │  │  ├─ tree
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ update-manager
│  │  │  │     └─ route.ts
│  │  │  ├─ holidays
│  │  │  │  └─ route.ts
│  │  │  ├─ leaves
│  │  │  │  ├─ [id]
│  │  │  │  │  └─ approve
│  │  │  │  │     └─ route.ts
│  │  │  │  ├─ apply
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ attachment
│  │  │  │     └─ [id]
│  │  │  │        └─ route.ts
│  │  │  ├─ letters
│  │  │  │  ├─ [id]
│  │  │  │  │  ├─ download
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ bulk-send
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ email-logs
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ employees
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ history
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ templates
│  │  │  │     ├─ [id]
│  │  │  │     │  └─ route.ts
│  │  │  │     └─ route.ts
│  │  │  ├─ notifications
│  │  │  │  ├─ register
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ route.ts
│  │  │  │  ├─ subscribe
│  │  │  │  └─ test
│  │  │  │     └─ route.ts
│  │  │  ├─ payroll
│  │  │  │  ├─ generate
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ payslip
│  │  │  │     └─ route.ts
│  │  │  ├─ profile
│  │  │  │  └─ route.ts
│  │  │  ├─ requests
│  │  │  │  └─ submit
│  │  │  │     └─ route.ts
│  │  │  └─ shifts
│  │  │     ├─ [id]
│  │  │     │  └─ route.ts
│  │  │     └─ route.ts
│  │  ├─ employee
│  │  │  ├─ approvals
│  │  │  │  ├─ ApprovalClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ attendance
│  │  │  │  ├─ AttendanceClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ calendar
│  │  │  │  └─ page.tsx
│  │  │  ├─ dashboard
│  │  │  │  ├─ DashboardClient.tsx
│  │  │  │  ├─ ReportingStructure.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ layout.tsx
│  │  │  ├─ leaves
│  │  │  │  ├─ LeavesClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ my-team
│  │  │  │  └─ page.tsx
│  │  │  ├─ payslips
│  │  │  │  ├─ PayslipsClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  ├─ permissions
│  │  │  │  ├─ PermissionClient.tsx
│  │  │  │  └─ page.tsx
│  │  │  └─ profile
│  │  │     └─ page.tsx
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  ├─ login
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  └─ unauthorized
│  │     └─ page.tsx
│  ├─ auth.config.ts
│  ├─ auth.ts
│  ├─ components
│  │  ├─ AttendanceButtons.tsx
│  │  ├─ CompanyProvider.tsx
│  │  ├─ CompanySwitcher.tsx
│  │  ├─ DashboardLayoutClient.tsx
│  │  ├─ NativePushNotifications.tsx
│  │  ├─ NotificationSlide.tsx
│  │  ├─ PayslipDocument.tsx
│  │  ├─ ProfileClient.tsx
│  │  ├─ PushNotificationInitializer.tsx
│  │  ├─ Sidebar.tsx
│  │  ├─ ThemeToggle.tsx
│  │  ├─ TopNav.tsx
│  │  ├─ UserStatusWatcher.tsx
│  │  ├─ WebPushInitializer.tsx
│  │  ├─ WebPushModal.tsx
│  │  └─ employee
│  ├─ lib
│  │  ├─ attendanceUtils.ts
│  │  ├─ bulkEmailService.ts
│  │  ├─ emailService.ts
│  │  ├─ firebase.ts
│  │  ├─ firebaseAdmin.ts
│  │  ├─ generatePayslipPdf.tsx
│  │  ├─ halfDayUtils.ts
│  │  ├─ letterUtils.ts
│  │  ├─ mongodb.ts
│  │  ├─ multiTenantPlugin.ts
│  │  ├─ payslipTemplate.ts
│  │  ├─ pdfService.tsx
│  │  ├─ pushNotifications.ts
│  │  ├─ salaryUtils.ts
│  │  ├─ sendWebPushNotification.ts
│  │  ├─ sessionUtils.ts
│  │  ├─ webPushNotifications.ts
│  │  └─ zohoWorkdrive.ts
│  ├─ middleware.ts
│  ├─ models
│  │  ├─ ApprovalAuditLog.ts
│  │  ├─ Attendance.ts
│  │  ├─ AttendanceCorrection.ts
│  │  ├─ BonusHistory.ts
│  │  ├─ CompOffCredit.ts
│  │  ├─ Company.ts
│  │  ├─ EmployeeLeaveBalance.ts
│  │  ├─ GeneratedLetter.ts
│  │  ├─ Holiday.ts
│  │  ├─ Leave.ts
│  │  ├─ LeavePolicy.ts
│  │  ├─ LetterAuditLog.ts
│  │  ├─ LetterEmailLog.ts
│  │  ├─ LetterTemplate.ts
│  │  ├─ MissPunch.ts
│  │  ├─ Notification.ts
│  │  ├─ OvertimeRequest.ts
│  │  ├─ Payroll.ts
│  │  ├─ Permission.ts
│  │  ├─ PermissionBalance.ts
│  │  ├─ PermissionCompensation.ts
│  │  ├─ PushToken.ts
│  │  ├─ Shift.ts
│  │  ├─ SystemAuditLog.ts
│  │  ├─ User.ts
│  │  └─ WFHRequest.ts
│  ├─ services
│  │  ├─ LeaveBalanceEngine.ts
│  │  ├─ api.ts
│  │  └─ hierarchy.service.ts
│  └─ types
│     ├─ global.d.ts
│     └─ next-auth.d.ts
├─ tsconfig.json
└─ vercel.json

```