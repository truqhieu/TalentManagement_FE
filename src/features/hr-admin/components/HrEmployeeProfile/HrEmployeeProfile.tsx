import { FormProvider, useForm, useWatch, type Control } from 'react-hook-form'

import type { EmployeeEntity } from '@/features/hr-admin/api'

import { useAuthStore } from '@/stores/auth.store'
import { useUploadMePortrait } from '@/features/profile/hooks'
import { useQuery } from '@tanstack/react-query'
import { organizationApi } from '@/features/organization/api'
import { type MeUserDisplayKey, type MeUserSelf } from '@/features/profile/userSelf.types'
import {
  isDateFormField,
  isWorkOrgReadonlyField,
  USER_SELF_FORM_SECTIONS,
  type UserSelfFieldSpec,
} from '@/features/profile/userSelfFormLayout'
import {
  formatUserDateForReadonlyDisplay,
  parseStoredDateToInputValue,
} from '@/features/profile/profileDateUtils'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { profileApi } from '@/features/profile/api'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/axios'
import { EmployeeExtraTeamsField, extraTeamIdsEqual } from '../EmployeeExtraTeamsField'
import { levelPillText } from '../HrEmployeeList/employeeListUtils'
import { ROLE_LABEL_VI } from '@/lib/roleLabels'
import type { Role } from '@/types/auth'
import { EmployeeAvatar } from '@/components/shared/EmployeeAvatar'
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl'
import { Building2, RefreshCw, Upload } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  DateController,
  InputController,
  SelectController,
  TextareaController,
} from '@/components/ui/form-controllers'
import { SelectItem } from '@/components/ui/select'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import {
  useAnyActionPending,
  useAttachmentSignedUrl,
  useDeactivateEmployee,
  useDirectManagerOptions,
  useEmployee,
  useUpdateEmployee,
  useUpdateEmployeeById,
} from '../../hooks'
import { EmployeeLoginCredentialCard } from './EmployeeLoginCredentialCard'
import { EMPLOYEE_PATCH_KEYS, type EditEmployeeBody, type EmployeePatchKey } from '../../types'
import { teamPositionOptions } from '../../teamPositionOptions'
import {
  buildDirectManagerSelectOptions,
  directManagerIdToStoredName,
  resolveDirectManagerFormValue,
  type DirectManagerOption,
} from '../../directManagerOptions'
export interface HrEmployeeProfileProps {
  employee: IHrEmployeeProfileState
  /** Mặc định mở tab khi vào từ URL `?mode=edit`. */
  initialTab?: number
}
export type IHrEmployeeProfileState = MeUserSelf

type EmploymentStatusUi = 'working' | 'resigned' | 'transferred'

const EMPLOYMENT_STATUS_OPTIONS: { value: EmploymentStatusUi; label: string }[] = [
  { value: 'working', label: 'Đang làm việc' },
  { value: 'transferred', label: 'Điều chuyển' },
  { value: 'resigned', label: 'Đã nghỉ' },
]

type EditRecord = Record<EmployeePatchKey, string> & {
  extraTeamIds: string[]
  employmentStatusUi: EmploymentStatusUi
}

const fieldStackGap = 'gap-1'
const fieldBoxClass = ''

const inputEditable =
  'border-slate-200 bg-white text-sm text-slate-700 shadow-sm transition-all focus:border-primary focus:ring-4 focus:ring-primary/10'

const fieldControlClass =
  'h-10 w-full rounded-xl border px-3 py-2 leading-snug outline-none transition-all'

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5">
      <span className="h-3 w-0.5 rounded-full bg-slate-300" aria-hidden />
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{children}</span>
    </span>
  )
}

function emptyEditRecord(): EditRecord {
  return {
    ...(Object.fromEntries(EMPLOYEE_PATCH_KEYS.map((k) => [k, ''])) as Record<
      EmployeePatchKey,
      string
    >),
    extraTeamIds: [],
    employmentStatusUi: 'working',
  }
}

function resolveEmploymentStatusUi(
  employee: IHrEmployeeProfileState,
  summaryStatus?: EmployeeEntity['status']
): EmploymentStatusUi {
  if (summaryStatus) {
    if (summaryStatus === 'INACTIVE') return 'resigned'
    if (summaryStatus === 'TRANSFERRED') return 'transferred'
    return 'working'
  }
  if (isEmploymentTransferred(employee.employmentStatus)) return 'transferred'
  if (isEmploymentInactive(employee.employmentStatus)) return 'resigned'
  return 'working'
}

function canManageEmploymentStatusRole(role: string | null | undefined): boolean {
  return role === 'MANAGER' || role === 'HR'
}

function foldEmploymentStatusText(employmentStatus: string | null | undefined): string {
  return (employmentStatus ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
}

function isEmploymentInactive(employmentStatus: string | null | undefined): boolean {
  const raw = (employmentStatus ?? '').trim()
  if (!raw) return false
  const upper = raw.toUpperCase()
  if (upper === 'INACTIVE' || upper === 'TERMINATED') return true
  return /thoi viec|nghi viec|da nghi|inactive|ngung hoat dong|sa thai/.test(
    foldEmploymentStatusText(raw)
  )
}

function isEmploymentTransferred(employmentStatus: string | null | undefined): boolean {
  const raw = (employmentStatus ?? '').trim()
  if (!raw) return false
  if (raw.toUpperCase() === 'TRANSFERRED') return true
  return /dieu chuyen|transferred/.test(foldEmploymentStatusText(raw))
}

function EmploymentStatusField({ control }: { control: Control<EditRecord> }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/30',
        fieldStackGap
      )}
    >
      <SelectController
        control={control}
        name="employmentStatusUi"
        label="Tình trạng làm việc"
        placeholder="Chọn tình trạng"
        className={cn('space-y-1.5', fieldBoxClass)}
        labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
        triggerClassName={cn(fieldControlClass, inputEditable)}
        customLabel={<FieldLabel>Tình trạng làm việc</FieldLabel>}
      >
        {EMPLOYMENT_STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectController>
    </div>
  )
}

function ProfileActionButtons({
  isInactive,
  canDeactivate,
  canReactivate,
  showEmploymentStatusActions,
  isSaving,
  patchPending,
  onDeactivate,
  onReactivate,
  onSave,
}: {
  isInactive: boolean
  canDeactivate: boolean
  canReactivate: boolean
  showEmploymentStatusActions: boolean
  isSaving: boolean
  patchPending: boolean
  onDeactivate: () => void
  onReactivate: () => void
  onSave: () => void
}) {
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      {!showEmploymentStatusActions && isInactive && canReactivate ? (
        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={onReactivate}
          className="h-12 w-full rounded-2xl border-primary/30 bg-primary/10 px-6 text-sm font-bold text-primary hover:bg-primary/15 sm:w-auto sm:min-w-[180px]"
        >
          Kích hoạt lại
        </Button>
      ) : null}
      {!showEmploymentStatusActions && !isInactive && canDeactivate ? (
        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={onDeactivate}
          className="h-12 w-full rounded-2xl border-destructive/40 bg-destructive/10 px-6 text-sm font-bold text-destructive hover:bg-destructive/15 sm:w-auto sm:min-w-[180px]"
        >
          Hủy hoạt động
        </Button>
      ) : null}
      <Button
        type="button"
        disabled={isSaving}
        onClick={onSave}
        className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:min-w-[220px] sm:px-8"
      >
        {patchPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
        {patchPending ? 'Đang lưu…' : 'Lưu thay đổi'}
      </Button>
    </div>
  )
}

const Form = FormProvider

function userToEdit(
  u: IHrEmployeeProfileState,
  managers: Pick<EmployeeEntity, 'id' | 'name'>[] = []
): EditRecord {
  const r = emptyEditRecord()
  for (const k of EMPLOYEE_PATCH_KEYS) {
    if (isDateFormField(k)) {
      r[k] = parseStoredDateToInputValue(u[k])
    } else {
      r[k] = u[k] == null ? '' : String(u[k])
    }
  }
  if (!r.displayName && u.fullNameLegal) {
    r.displayName = u.fullNameLegal
  }
  const resolvedManager = resolveDirectManagerFormValue(u.directManager, managers)
  r.directManager = resolvedManager === '__none' ? '' : resolvedManager
  r.extraTeamIds = u.extraTeamIds ?? u.teamIds?.slice(1) ?? []
  r.employmentStatusUi = resolveEmploymentStatusUi(u)
  return r
}

function toDisplayRole(role: string | null | undefined): Role {
  const value = role ?? 'MEMBER'
  if (value in ROLE_LABEL_VI) return value as Role
  return 'MEMBER'
}

function toPatch(
  edit: EditRecord,
  original: IHrEmployeeProfileState,
  managers: Pick<EmployeeEntity, 'id' | 'name'>[]
): EditEmployeeBody {
  const nz = (s: string) => (s.trim() === '' ? null : s.trim())
  const body = {} as EditEmployeeBody
  for (const k of EMPLOYEE_PATCH_KEYS) {
    body[k] =
      k === 'directManager'
        ? directManagerIdToStoredName(edit.directManager, managers)
        : nz(edit[k] ?? '')
  }
  const origExtras = original.extraTeamIds ?? original.teamIds?.slice(1) ?? []
  if (!extraTeamIdsEqual(edit.extraTeamIds ?? [], origExtras)) {
    body.extraTeamIds = edit.extraTeamIds ?? []
  }
  return body
}

function workOrgReadonlyValue(employee: IHrEmployeeProfileState, key: MeUserDisplayKey): string {
  if (key === 'startDateWork') return formatUserDateForReadonlyDisplay(employee.startDateWork)
  const v = employee[key]
  return v == null ? '—' : String(v)
}

function ProfileReadonlyInfo({
  name,
  label,
  value,
  control,
}: {
  name: EmployeePatchKey
  label: string
  value: string
  control: ReturnType<typeof useForm<EditRecord>>['control']
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/30',
        fieldStackGap
      )}
    >
      {name === 'teamPosition' ? (
        <SelectController
          key={name}
          control={control}
          name={name}
          label={label}
          placeholder="Chọn loại hợp đồng / vị trí"
          className={cn('space-y-1.5', fieldBoxClass)}
          labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
          triggerClassName={cn(fieldControlClass, inputEditable)}
          customLabel={<FieldLabel>{label}</FieldLabel>}
        >
          {teamPositionOptions?.map((j) => (
            <SelectItem key={j.value} value={j.value}>
              {j.label}
            </SelectItem>
          ))}
        </SelectController>
      ) : (
        <InputController
          control={control}
          value={value}
          name={name}
          label={label}
          type="text"
          autoComplete="off"
          className={cn('space-y-1.5', fieldBoxClass)}
          labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
          inputClassName={cn(fieldControlClass, inputEditable)}
          customLabel={<FieldLabel>{label}</FieldLabel>}
        />
      )}
    </div>
  )
}

/** CCCD/CV lưu trong bucket riêng tư — xem qua signed URL tạm, không hiện đường dẫn thô. */
function AttachmentViewerField({
  employeeId,
  label,
  hasValue,
  field,
}: {
  employeeId: string
  label: string
  hasValue: boolean
  field: 'attachmentIdFront' | 'attachmentIdBack' | 'cvAttachmentRef'
}) {
  const { mutate, isPending } = useAttachmentSignedUrl()
  const anyActionPending = useAnyActionPending()

  const onView = () => {
    mutate(
      { id: employeeId, field },
      {
        onSuccess: (data) => {
          if (!data.signedUrl) {
            toast.error('Không tìm thấy tài liệu')
            return
          }
          window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
        },
      }
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/30',
        fieldStackGap
      )}
    >
      <FieldLabel>{label}</FieldLabel>
      {hasValue ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-fit"
          onClick={onView}
          disabled={isPending || anyActionPending}
        >
          {isPending ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Xem tài liệu
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Chưa có</span>
      )}
    </div>
  )
}

function renderField(
  field: UserSelfFieldSpec,
  ctx: {
    employee: IHrEmployeeProfileState
    control: ReturnType<typeof useForm<EditRecord>>['control']
    divisions?: Array<{ id: string; name: string }>
    teams?: Array<{ id: string; name: string }>
    positions?: Array<{ value: string; label: string }>
    jobTitles?: Array<{ value: string; label: string }>
    directManagerOptions?: DirectManagerOption[]
  }
) {
  const { employee, control, divisions, teams, positions, jobTitles, directManagerOptions } = ctx

  if (field.kind === 'portrait') {
    return null
  }

  if (field.key === 'directManager') {
    return (
      <SelectController
        key={field.key}
        control={control}
        name="directManager"
        label={field.label}
        placeholder="Chọn quản lý trực tiếp"
        className={cn('space-y-1.5', fieldBoxClass)}
        labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
        triggerClassName={cn(fieldControlClass, inputEditable)}
        customLabel={<FieldLabel>{field.label}</FieldLabel>}
      >
        <SelectItem value="__none">Chưa chọn</SelectItem>
        {(directManagerOptions ?? []).map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectController>
    )
  }

  if (
    field.key === 'attachmentIdFront' ||
    field.key === 'attachmentIdBack' ||
    field.key === 'cvAttachmentRef'
  ) {
    return (
      <AttachmentViewerField
        key={field.key}
        employeeId={employee.id}
        label={field.label}
        hasValue={!!employee[field.key]}
        field={field.key}
      />
    )
  }

  if (isWorkOrgReadonlyField(field.key)) {
    return (
      <ProfileReadonlyInfo
        name={field.key as EmployeePatchKey}
        key={field.key}
        label={field.label}
        value={workOrgReadonlyValue(employee, field.key)}
        control={control}
      />
    )
  }

  const key = field.key as EmployeePatchKey

  if (field.kind === 'division-select') {
    return (
      <SelectController
        key={field.key}
        control={control}
        name={key}
        label={field.label}
        placeholder="Chọn phòng ban"
        className={cn('space-y-1.5', fieldBoxClass)}
        labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
        triggerClassName={cn(fieldControlClass, inputEditable)}
        customLabel={<FieldLabel>{field.label}</FieldLabel>}
      >
        <SelectItem value="__none">Chưa chọn</SelectItem>
        {divisions?.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectController>
    )
  }

  if (field.kind === 'team-select') {
    return (
      <SelectController
        key={field.key}
        control={control}
        name={key}
        label={field.label}
        placeholder="Chọn nhóm"
        className={cn('space-y-1.5', fieldBoxClass)}
        labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
        triggerClassName={cn(fieldControlClass, inputEditable)}
        customLabel={<FieldLabel>{field.label}</FieldLabel>}
      >
        <SelectItem value="__none">Chưa chọn</SelectItem>
        {teams?.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectController>
    )
  }

  if (field.kind === 'position-select') {
    return (
      <SelectController
        key={field.key}
        control={control}
        name={key}
        label={field.label}
        placeholder={field.key === 'contractType' ? 'Chọn loại hợp đồng / vị trí' : 'Chọn vị trí'}
        className={cn('space-y-1.5', fieldBoxClass)}
        labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
        triggerClassName={cn(fieldControlClass, inputEditable)}
        customLabel={<FieldLabel>{field.label}</FieldLabel>}
      >
        <SelectItem value="__none">Chưa chọn</SelectItem>
        {positions?.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectController>
    )
  }

  if (field.kind === 'job-title-select') {
    return (
      <SelectController
        key={field.key}
        control={control}
        name={key}
        label={field.label}
        placeholder="Chọn vị trí chuyên môn"
        className={cn('space-y-1.5', fieldBoxClass)}
        labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
        triggerClassName={cn(fieldControlClass, inputEditable)}
        customLabel={<FieldLabel>{field.label}</FieldLabel>}
      >
        {jobTitles?.map((j) => (
          <SelectItem key={j.value} value={j.value}>
            {j.label}
          </SelectItem>
        ))}
      </SelectController>
    )
  }

  if (isDateFormField(field.key)) {
    return (
      <DateController
        key={field.key}
        control={control}
        name={key}
        label={field.label}
        className={cn('space-y-1.5', fieldBoxClass)}
        labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
        datePickerClassName={cn(fieldControlClass, '[color-scheme:light]', inputEditable)}
        customLabel={<FieldLabel>{field.label}</FieldLabel>}
      />
    )
  }

  if (field.multiline) {
    return (
      <TextareaController
        key={field.key}
        control={control}
        name={key}
        label={field.label}
        className={cn('space-y-1.5 sm:col-span-2 lg:col-span-2', fieldBoxClass)}
        labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
        textareaClassName={cn(
          'min-h-[80px] w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
          inputEditable
        )}
        customLabel={<FieldLabel>{field.label}</FieldLabel>}
      />
    )
  }
  return (
    <InputController
      key={field.key}
      control={control}
      name={key}
      label={field.label}
      type="text"
      autoComplete="off"
      className={cn('space-y-1.5', fieldBoxClass)}
      labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
      inputClassName={cn(fieldControlClass, inputEditable)}
      customLabel={<FieldLabel>{field.label}</FieldLabel>}
    />
  )
}

function ProfileIdentityCard({
  control,
  u,
  role,
  currentLevelTitle,
  departmentDisplayName,
  portraitUploading,
  uploadDisabled = false,
  avatarUploadInputId,
  onPortraitFile,
  fallbackUserName,
  fallbackUserEmail,
}: {
  control: Control<EditRecord>
  u: MeUserSelf
  role: Role
  currentLevelTitle: string
  departmentDisplayName: string
  portraitUploading: boolean
  /** Khoá nút upload khi có thao tác khác đang chạy (không hiện overlay loading trên avatar). */
  uploadDisabled?: boolean
  avatarUploadInputId: string
  onPortraitFile: (file: File) => void
  fallbackUserName: string
  fallbackUserEmail: string
}) {
  const watchedDisplayName = useWatch({ control, name: 'displayName' }) ?? ''
  const watchedFullNameLegal = useWatch({ control, name: 'fullNameLegal' }) ?? ''
  const portraitRef = useWatch({ control, name: 'portraitRef' }) ?? ''

  const displayName = useMemo(() => {
    const fromForm = watchedDisplayName.trim() || watchedFullNameLegal.trim()
    if (fromForm) return fromForm
    return u.displayName?.trim() || u.fullNameLegal?.trim() || fallbackUserName || 'Nhân viên'
  }, [fallbackUserName, u, watchedDisplayName, watchedFullNameLegal])

  const email = useMemo(() => {
    return u.email?.trim() || fallbackUserEmail || '—'
  }, [u, fallbackUserEmail])

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center">
      <div className="relative shrink-0">
        <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-4 border-white shadow-xl md:h-28 md:w-28 dark:border-slate-800">
          <EmployeeAvatar
            name={displayName}
            photoUrl={resolvePublicAssetUrl(portraitRef)}
            className="h-full w-full object-cover text-2xl"
          />
          {portraitUploading && (
            <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <RefreshCw className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
          <Input
            id={avatarUploadInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={portraitUploading || uploadDisabled}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPortraitFile(f)
              e.target.value = ''
            }}
          />
          <label
            htmlFor={avatarUploadInputId}
            className={cn(
              'absolute bottom-1 right-1 z-[2] flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md ring-2 ring-white transition-transform hover:scale-110 hover:bg-primary/90 active:scale-95 dark:ring-slate-900',
              'md:bottom-1.5 md:right-1.5',
              (portraitUploading || uploadDisabled) && 'pointer-events-none opacity-50'
            )}
            aria-label="Tải ảnh đại diện"
          >
            <Upload className="h-4 w-4" strokeWidth={2.25} />
          </label>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            {displayName}
          </h2>
          <p className="text-sm font-medium text-slate-500">{email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="h-6 border-indigo-400/30 bg-indigo-500/10 px-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300"
          >
            {ROLE_LABEL_VI[role]}
          </Badge>
          <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <Building2 className="h-3 w-3" />
            <span>{departmentDisplayName}</span>
          </div>
          <Badge
            variant="outline"
            className="h-6 border-fuchsia-400/30 bg-fuchsia-500/10 px-2 text-xs font-semibold uppercase tracking-wide text-fuchsia-600 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/30 dark:text-fuchsia-300"
          >
            Cấp độ: {currentLevelTitle}
          </Badge>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({
  children,
  icon,
  variant = 'primary',
}: {
  children: string
  icon?: React.ReactNode
  variant?: 'primary' | 'indigo' | 'violet' | 'emerald'
}) {
  const configs = {
    primary: 'bg-primary/10 text-primary',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  }
  return (
    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg font-bold',
          configs[variant]
        )}
      >
        {icon || <Building2 className="h-4 w-4" />}
      </div>
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
        {children}
      </h3>
    </div>
  )
}

export function HrEmployeeProfile({ employee }: HrEmployeeProfileProps) {
  const viewer = useAuthStore((s) => s.user)
  const { canId } = usePermission()
  const canDeactivate = canId('hr.employees.deactivate') || canId('hr.employees.edit')
  const canReactivate = canId('hr.employees.edit')
  const canEditLoginCredential = canId('hr.employees.edit')
  const { mutate: patchUser, isPending: patchPending } = useUpdateEmployeeById()
  const { data: employeeSummary, isLoading: summaryLoading } = useEmployee(employee.id)
  const deactivate = useDeactivateEmployee()
  const updateEmployee = useUpdateEmployee()
  const [confirmPending, setConfirmPending] = useState<'deactivate' | 'reactivate' | null>(null)
  const { mutate: uploadPortrait, isPending: portraitUploading } = useUploadMePortrait()
  const { data: divisionsList = [] } = useQuery({
    queryKey: ['organization', 'divisions-list'],
    queryFn: () => organizationApi.getDivisionsList(),
    staleTime: 60_000,
  })
  const { data: teamsList = [] } = useQuery({
    queryKey: ['organization', 'teams-list'],
    queryFn: () => organizationApi.getTeamsList(),
    staleTime: 60_000,
  })
  const { data: directManagersData } = useDirectManagerOptions()
  const managers = useMemo(() => directManagersData?.data ?? [], [directManagersData])
  const directManagerOptions = useMemo(
    () => buildDirectManagerSelectOptions(managers, employee.id, employee.directManager),
    [managers, employee.id, employee.directManager]
  )
  const form = useForm<EditRecord>({
    defaultValues: userToEdit(employee, managers),
  })
  const { control, handleSubmit, reset, setValue } = form
  const selectedTeamId = useWatch({ control, name: 'teamId' }) ?? ''
  const selectedDivisionId = useWatch({ control, name: 'divisionId' }) ?? ''
  const prevDivisionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (prevDivisionIdRef.current === null) {
      prevDivisionIdRef.current = selectedDivisionId
      return
    }
    if (prevDivisionIdRef.current !== selectedDivisionId) {
      setValue('teamId', '')
      setValue('extraTeamIds', [])
      prevDivisionIdRef.current = selectedDivisionId
    }
  }, [selectedDivisionId, setValue])

  useEffect(() => {
    reset({
      ...userToEdit(employee, managers),
      employmentStatusUi: resolveEmploymentStatusUi(employee, employeeSummary?.status),
    })
    prevDivisionIdRef.current = employee.divisionId?.trim() ?? ''
  }, [employee, employeeSummary?.status, managers, reset])

  const divisions = useMemo(
    () => divisionsList.map((d) => ({ id: d.id, name: d.name })),
    [divisionsList]
  )
  const teams = useMemo(() => {
    const divisionId = selectedDivisionId.trim()
    const mapped = teamsList.map((t) => ({
      id: t.id,
      name: t.name,
      teamGroupId: t.teamGroupId,
    }))
    if (!divisionId) return mapped.map(({ id, name }) => ({ id, name }))
    return mapped.filter((t) => t.teamGroupId === divisionId).map(({ id, name }) => ({ id, name }))
  }, [teamsList, selectedDivisionId])
  const allTeamOptions = useMemo(
    () => teamsList.map((t) => ({ value: t.id, label: t.name })),
    [teamsList]
  )
  const departmentDisplayName = useMemo(() => {
    const divisionId = selectedDivisionId.trim()
    if (divisionId) {
      return divisions.find((d) => d.id === divisionId)?.name ?? '—'
    }
    return employee.departmentName?.trim() || '—'
  }, [selectedDivisionId, divisions, employee.departmentName])
  const { data: positionsData } = useQuery({
    queryKey: ['profile', 'positions'],
    queryFn: () => profileApi.getPositions(),
  })
  const positions = useMemo(() => positionsData ?? [], [positionsData])
  const { data: jobTitlesData } = useQuery({
    queryKey: ['profile', 'job-titles'],
    queryFn: () => profileApi.getJobTitles(),
  })
  const jobTitles = useMemo(() => jobTitlesData ?? [], [jobTitlesData])

  const canManageEmploymentStatus = canManageEmploymentStatusRole(viewer?.role)
  const employeeRole = toDisplayRole(employeeSummary?.role ?? employee.role)
  const currentLevelId = employeeSummary?.currentLevel ?? 'tap_su'
  const currentLevelTitle = employeeSummary
    ? levelPillText(employeeSummary.currentLevel)
    : summaryLoading
      ? '…'
      : '—'
  const onPortraitFile = (file: File) => {
    uploadPortrait(file, {
      onSuccess: (res) => {
        toast.success('Đã cập nhật ảnh đại diện')
        setValue('portraitRef', res.portraitRef)
        if (viewer) {
          useAuthStore.getState().setUser({
            ...viewer,
            portraitRef: res.portraitRef,
          })
        }
      },
      onError: (err) => toast.error(getApiErrorMessage(err)),
    })
  }

  const workSection = USER_SELF_FORM_SECTIONS[0]!
  const workReadonlyFields = workSection.fields.filter(
    (field) => isWorkOrgReadonlyField(field.key) || field.key === 'directManager'
  )
  const workEditableFields = workSection.fields.filter(
    (field) => !isWorkOrgReadonlyField(field.key) && field.key !== 'directManager'
  )
  const detailSections = USER_SELF_FORM_SECTIONS.slice(1)
  const detailSectionVariants: ('indigo' | 'violet' | 'emerald' | 'primary')[] = [
    'indigo',
    'violet',
    'emerald',
    'primary',
    'indigo',
  ]
  const initialEmploymentStatusUi = resolveEmploymentStatusUi(employee, employeeSummary?.status)
  const onSaveProfile = handleSubmit((values) => {
    const profilePatch = toPatch(values, employee, managers) as unknown as IHrEmployeeProfileState
    const statusChanged =
      canManageEmploymentStatus && values.employmentStatusUi !== initialEmploymentStatusUi

    const applyStatusChange = () => {
      if (!statusChanged) return
      if (values.employmentStatusUi === 'resigned') {
        deactivate.mutate(employee.id)
        return
      }
      if (values.employmentStatusUi === 'transferred') {
        updateEmployee.mutate({ id: employee.id, patch: { status: 'TRANSFERRED' } })
        return
      }
      updateEmployee.mutate({ id: employee.id, patch: { status: 'ACTIVE' } })
    }

    patchUser({ id: employee.id, patch: profilePatch }, { onSuccess: applyStatusChange })
  })

  const isInactive = employeeSummary
    ? employeeSummary.status === 'INACTIVE'
    : isEmploymentInactive(employee.employmentStatus)
  /** Khoá mọi nút hành động khi có bất kỳ thao tác nào đang chạy (lưu, upload ảnh, mở tài liệu…). */
  const anyActionPending = useAnyActionPending()
  const isSaving =
    patchPending || deactivate.isPending || updateEmployee.isPending || anyActionPending

  const handleConfirmPending = () => {
    if (!confirmPending) return
    if (confirmPending === 'deactivate') {
      deactivate.mutate(employee.id)
    } else {
      updateEmployee.mutate({ id: employee.id, patch: { status: 'ACTIVE' } })
    }
    setConfirmPending(null)
  }

  const accountActions = {
    isInactive,
    canDeactivate,
    canReactivate,
    showEmploymentStatusActions: canManageEmploymentStatus,
    isSaving,
    patchPending,
    onDeactivate: () => setConfirmPending('deactivate'),
    onReactivate: () => setConfirmPending('reactivate'),
    onSave: onSaveProfile,
  }

  const fieldCtx = {
    employee,
    control,
    divisions,
    teams,
    positions,
    jobTitles,
    directManagerOptions,
  }
  const avatarUploadInputId = useId()
  return (
    <Form {...form}>
      <div
        className="relative -m-5 min-h-[calc(100vh-3rem)] bg-slate-50/50 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-6 text-foreground md:-m-6 md:pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:-m-8 dark:bg-slate-950"
        data-current-level-id={currentLevelId}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-20 -top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-16 top-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute bottom-8 left-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
        </div>

        <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6">
          <div className="mb-4 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              to="/hr-admin"
              search={{ page: 1, pageSize: 15 }}
              className="font-semibold text-primary hover:underline"
            >
              ← Danh sách nhân sự
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-semibold text-foreground">{employee.fullNameLegal}</span>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-indigo-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 right-0 h-48 w-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl" />
                <div className="relative z-10">
                  <ProfileIdentityCard
                    control={control}
                    u={employee}
                    role={employeeRole}
                    currentLevelTitle={currentLevelTitle}
                    departmentDisplayName={departmentDisplayName}
                    portraitUploading={portraitUploading}
                    uploadDisabled={anyActionPending}
                    avatarUploadInputId={avatarUploadInputId}
                    onPortraitFile={onPortraitFile}
                    fallbackUserName={employee.displayName ?? employee.fullNameLegal ?? ''}
                    fallbackUserEmail={employee.email ?? ''}
                  />
                </div>
              </section>

              <EmployeeLoginCredentialCard
                employeeId={employee.id}
                canEdit={canEditLoginCredential}
              />

              <section className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="mb-8 flex items-center gap-3">
                  <div className="h-8 w-1.5 rounded-full bg-gradient-to-b from-primary to-violet-600" />
                  <h2 className="text-xl font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                    Chi tiết hồ sơ
                  </h2>
                </div>

                <div className="space-y-8">
                  <div className="rounded-2xl border border-slate-200 border-l-4 border-l-primary bg-white p-6 shadow-sm dark:border-slate-800 dark:border-l-primary dark:bg-slate-900/50">
                    <SectionTitle variant="primary">{workSection.title}</SectionTitle>
                    {workReadonlyFields.length > 0 ? (
                      <div className="mb-8">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-primary/50">
                          Thông tin đồng bộ
                        </p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {workReadonlyFields.map((f) => renderField(f, fieldCtx))}
                          {canManageEmploymentStatus ? (
                            <EmploymentStatusField control={control} />
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {workEditableFields.length > 0 ? (
                      <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Thông tin có thể cập nhật
                        </p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {workEditableFields.map((f) => renderField(f, fieldCtx))}
                          <div className="sm:col-span-2">
                            <EmployeeExtraTeamsField
                              control={control}
                              name="extraTeamIds"
                              primaryTeamId={selectedTeamId}
                              allTeams={allTeamOptions}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {detailSections.map((section, idx) => (
                    <div
                      key={section.title}
                      className={cn(
                        'rounded-2xl border border-slate-200 border-l-4 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50',
                        idx % 3 === 0
                          ? 'border-l-indigo-500'
                          : idx % 3 === 1
                            ? 'border-l-violet-500'
                            : 'border-l-emerald-500'
                      )}
                    >
                      <SectionTitle variant={detailSectionVariants[idx]}>
                        {section.title}
                      </SectionTitle>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {section.fields.map((f) => renderField(f, fieldCtx))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 bottom-0 z-[60]"
              role="presentation"
            >
              <div
                className="pointer-events-auto border-t border-slate-200/90 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95"
                role="region"
                aria-label="Thao tác hồ sơ"
              >
                <div className="mx-auto flex w-full max-w-[1400px]">
                  <ProfileActionButtons {...accountActions} />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {!canManageEmploymentStatus ? (
        <ConfirmDialog
          open={confirmPending !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmPending(null)
          }}
          title={
            confirmPending === 'deactivate' ? 'Vô hiệu hóa tài khoản?' : 'Kích hoạt lại tài khoản?'
          }
          description={
            confirmPending === 'deactivate'
              ? 'Nhân viên sẽ không thể đăng nhập sau khi bị vô hiệu hóa.'
              : 'Nhân viên sẽ được khôi phục quyền đăng nhập.'
          }
          confirmLabel={confirmPending === 'deactivate' ? 'Vô hiệu hóa' : 'Kích hoạt'}
          destructive={confirmPending === 'deactivate'}
          onConfirm={handleConfirmPending}
        />
      ) : null}
    </Form>
  )
}
