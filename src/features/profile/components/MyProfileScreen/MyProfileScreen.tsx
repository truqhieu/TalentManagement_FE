import { useId, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { toast } from 'sonner'
import { Building2, RefreshCw, Upload } from 'lucide-react'
import { EmployeeAvatar } from '@/components/shared/EmployeeAvatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Form } from '@/components/ui/form'
import {
  DateController,
  InputController,
  TextareaController,
  SelectController,
} from '@/components/ui/form-controllers'
import { SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/axios'
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl'
import { ROLE_LABEL_VI } from '@/lib/roleLabels'
import { useAuthStore } from '@/stores/auth.store'
import { type PatchMeUserBody, usePatchMeUser, useUploadMePortrait } from '@/features/profile/hooks'
import { profileApi } from '@/features/profile/api'
import { organizationApi } from '@/features/organization/api'
import {
  EmployeeExtraTeamsField,
  extraTeamIdsEqual,
} from '@/features/hr-admin/components/EmployeeExtraTeamsField'
import type { MyProfilePage } from '@/features/profile/types'
import {
  formatUserDateForReadonlyDisplay,
  parseStoredDateToInputValue,
} from '@/features/profile/profileDateUtils'
import type {
  MeUserDisplayKey,
  MeUserPatchKey,
  MeUserSelf,
} from '@/features/profile/userSelf.types'
import { ME_USER_PATCH_KEYS } from '@/features/profile/userSelf.types'
import {
  USER_SELF_FORM_SECTIONS,
  isDateFormField,
  isWorkOrgReadonlyField,
  type UserSelfFieldSpec,
} from '@/features/profile/userSelfFormLayout'

export interface MyProfileScreenProps {
  page: MyProfilePage | undefined
  isLoading: boolean
}

const inputEditable =
  'border-slate-200 bg-white text-sm text-slate-700 shadow-sm transition-all focus:border-primary focus:ring-4 focus:ring-primary/10'

const fieldControlClass =
  'h-10 w-full rounded-xl border px-3 py-2 leading-snug outline-none transition-all'

const fieldStackGap = 'gap-1'
const fieldBoxClass = ''

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5">
      <span className="h-3 w-0.5 rounded-full bg-slate-300" aria-hidden />
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{children}</span>
    </span>
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

function workOrgReadonlyValue(u: MeUserSelf, key: MeUserDisplayKey): string {
  if (key === 'startDateWork') return formatUserDateForReadonlyDisplay(u.startDateWork)
  const v = u[key]
  return v == null ? '—' : String(v)
}

function mapCurrentTitleToLevelId(
  title: string
): 'tap_su' | 'biet_viec' | 'duoc_viec' | 'dong_gop_ket_qua' | 'tuong' {
  const normalized = title.trim().toLowerCase()
  if (normalized.includes('tập sự') || normalized.includes('tap su')) return 'tap_su'
  if (normalized.includes('biết việc') || normalized.includes('biet viec')) return 'biet_viec'
  if (normalized.includes('được việc') || normalized.includes('duoc viec')) return 'duoc_viec'
  if (normalized.includes('đóng góp') || normalized.includes('dong gop')) return 'dong_gop_ket_qua'
  if (normalized.includes('tướng') || normalized.includes('tuong')) return 'tuong'
  return 'biet_viec'
}

type EditRecord = Record<MeUserPatchKey, string> & { extraTeamIds: string[] }

function emptyEditRecord(): EditRecord {
  return {
    ...(Object.fromEntries(ME_USER_PATCH_KEYS.map((k) => [k, ''])) as Record<
      MeUserPatchKey,
      string
    >),
    extraTeamIds: [],
  }
}

function userToEdit(u: MeUserSelf): EditRecord {
  const r = emptyEditRecord()
  for (const k of ME_USER_PATCH_KEYS) {
    if (isDateFormField(k)) {
      r[k] = parseStoredDateToInputValue(u[k])
    } else {
      r[k] = u[k] == null ? '' : String(u[k])
    }
  }
  if (!r.displayName && u.fullNameLegal) {
    r.displayName = u.fullNameLegal
  }
  r.extraTeamIds = u.extraTeamIds ?? u.teamIds?.slice(1) ?? []
  return r
}

function toPatch(edit: EditRecord, original: MeUserSelf): PatchMeUserBody {
  const nz = (s: string) => (s.trim() === '' ? null : s.trim())
  const body = {} as PatchMeUserBody
  for (const k of ME_USER_PATCH_KEYS) {
    body[k] = nz(edit[k] ?? '')
  }
  const origExtras = original.extraTeamIds ?? original.teamIds?.slice(1) ?? []
  if (!extraTeamIdsEqual(edit.extraTeamIds ?? [], origExtras)) {
    body.extraTeamIds = edit.extraTeamIds ?? []
  }
  return body
}

function ProfileReadonlyInfo({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/30',
        fieldStackGap
      )}
    >
      <FieldLabel>{label}</FieldLabel>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{value || '—'}</p>
    </div>
  )
}

function renderField(
  field: UserSelfFieldSpec,
  ctx: {
    u: MeUserSelf
    control: ReturnType<typeof useForm<EditRecord>>['control']
    divisions?: Array<{ id: string; name: string }>
    teams?: Array<{ id: string; name: string }>
    positions?: Array<{ value: string; label: string }>
    jobTitles?: Array<{ value: string; label: string }>
  },
  role?: string | null
) {
  const { u, control, divisions, teams, positions, jobTitles } = ctx
  const forceReadonly = field.key === 'directManager'

  if (field.kind === 'portrait') {
    return null
  }

  if (isWorkOrgReadonlyField(field.key) || forceReadonly) {
    return (
      <ProfileReadonlyInfo
        key={field.key}
        label={field.label}
        value={workOrgReadonlyValue(u, field.key)}
      />
    )
  }

  const key = field.key as MeUserPatchKey

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

  return role === 'HR' || role === 'MANAGER' ? (
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
  ) : (
    <ProfileReadonlyInfo
      key={field.key}
      label={field.label}
      value={workOrgReadonlyValue(u, field.key)}
    />
  )
}

function ProfileIdentityCard({
  control,
  u,
  role,
  currentLevelTitle,
  portraitUploading,
  avatarUploadInputId,
  onPortraitFile,
  fallbackUserName,
  fallbackUserEmail,
}: {
  control: Control<EditRecord>
  u: MeUserSelf
  role: keyof typeof ROLE_LABEL_VI
  currentLevelTitle: string
  portraitUploading: boolean
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
            disabled={portraitUploading}
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
              portraitUploading && 'pointer-events-none opacity-50'
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
            <span>{u.departmentName?.trim() || '—'}</span>
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

function MyProfileScreenLoaded({ page, u }: { page: MyProfilePage; u: MeUserSelf }) {
  const user = useAuthStore((s) => s.user)
  const { mutate: patchUser, isPending: patchPending } = usePatchMeUser()
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
  const form = useForm<EditRecord>({
    defaultValues: userToEdit(u),
  })
  const { control, handleSubmit } = form
  const selectedTeamId = useWatch({ control, name: 'teamId' }) ?? ''

  const divisions = useMemo(
    () => divisionsList.map((d) => ({ id: d.id, name: d.name })),
    [divisionsList]
  )
  // Hiển thị tất cả nhóm, không lọc theo phòng ban
  const teams = useMemo(() => teamsList.map((t) => ({ id: t.id, name: t.name })), [teamsList])
  const allTeamOptions = useMemo(
    () => teamsList.map((t) => ({ value: t.id, label: t.name })),
    [teamsList]
  )
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

  const role = user?.role ?? 'MEMBER'
  const currentLevelId = mapCurrentTitleToLevelId(page.currentLevel.title)
  const onPortraitFile = (file: File) => {
    uploadPortrait(file, {
      onSuccess: (res) => {
        toast.success('Đã cập nhật ảnh đại diện')
        form.setValue('portraitRef', res.portraitRef)
        // Cập nhật vào auth store để Navbar thay đổi ngay
        if (user) {
          useAuthStore.getState().setUser({
            ...user,
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
  const detailSections = USER_SELF_FORM_SECTIONS.slice(1).filter((s) => s.title.trim() !== 'Khác')
  const detailSectionVariants: ('indigo' | 'violet' | 'emerald' | 'primary')[] = [
    'indigo',
    'violet',
    'emerald',
    'primary',
    'indigo',
  ]
  const onSaveProfile = handleSubmit((values) =>
    patchUser(toPatch(values, u), {
      onSuccess: () => {
        form.reset(values)
        toast.success('Đã lưu')
        if (user && values.displayName) {
          const primary = values.teamId?.trim() || null
          const teamIds = primary
            ? [primary, ...(values.extraTeamIds ?? []).filter((id) => id !== primary)]
            : [...(values.extraTeamIds ?? [])]
          useAuthStore.getState().setUser({
            ...user,
            name: values.displayName,
            teamIds,
          })
        }
      },
      onError: () => toast.error('Không lưu được. Thử lại sau.'),
    })
  )

  const fieldCtx = {
    u,
    control,
    divisions,
    teams,
    positions,
    jobTitles,
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

        <div className="mx-auto w-full px-4 md:px-6">
          <div className="mb-4 border-none bg-[#005236] p-8 text-white rounded-3xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col gap-4">
              <div className="min-w-0">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
                  Hồ sơ cá nhân
                </h1>
                <p className="text-blue-50/80 max-w-2xl font-medium">
                  Quản lý thông tin nhân sự và lộ trình phát triển.
                </p>
              </div>
            </div>
          </div>

          <div className="">
            <div className="space-y-4">
              <section className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-indigo-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 right-0 h-48 w-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl" />
                <div className="relative z-10">
                  <ProfileIdentityCard
                    control={control}
                    u={u}
                    role={role}
                    currentLevelTitle={page.currentLevel.title}
                    portraitUploading={portraitUploading}
                    avatarUploadInputId={avatarUploadInputId}
                    onPortraitFile={onPortraitFile}
                    fallbackUserName={user?.name ?? ''}
                    fallbackUserEmail={user?.email ?? ''}
                  />
                </div>
              </section>

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
                          Thông tin đồng bộ (chỉ xem)
                        </p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {workReadonlyFields.map((f) => renderField(f, fieldCtx))}
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
                        {section.fields.map((f) => renderField(f, fieldCtx, user?.role))}
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
                aria-label="Lưu hồ sơ"
              >
                <div className="mx-auto flex w-full max-w-[1400px] justify-stretch sm:justify-end">
                  <Button
                    type="button"
                    disabled={patchPending}
                    onClick={onSaveProfile}
                    className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:min-w-[220px] sm:px-8"
                  >
                    {patchPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {patchPending ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </Form>
  )
}

export function MyProfileScreen({ page, isLoading }: MyProfileScreenProps) {
  const u = page?.userRecord

  if (isLoading || !page || !u) {
    return (
      <div className="-m-5 flex min-h-[calc(100vh-3rem)] items-center justify-center bg-slate-50/50 p-8 text-muted-foreground md:-m-6 lg:-m-8">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-primary/40" />
            <span className="font-bold tracking-wide text-xs uppercase">Đang tải hồ sơ…</span>
          </div>
        ) : (
          'Không có dữ liệu'
        )}
      </div>
    )
  }

  return <MyProfileScreenLoaded key={`${u.id}-${u.updatedAt}`} page={page} u={u} />
}
