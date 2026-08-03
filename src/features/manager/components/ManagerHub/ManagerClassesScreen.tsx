import { ConfirmDialog } from '@/components/shared/ConfirmDialog/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Form } from '@/components/ui/form'
import { InputController, SelectController } from '@/components/ui/form-controllers'
import { Input } from '@/components/ui/input'
import { SelectItem } from '@/components/ui/select'
import {
  useClassMemberOptions,
  useCreateManagerClass,
  useDeleteManagerClass,
  useManagerClasses,
  useTeacherOptions,
  useUpdateManagerClass,
} from '@/features/manager/hooks'
import { CARD_ENTRANCE_HOVER } from '@/lib/cardMotion'
import { cn } from '@/lib/utils'
import { Calendar, Loader2, PlusCircle, Search, UserPlus2, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ClassCard } from './ClassCard'
import { ManagerScreenLayout } from './ManagerScreenLayout'

const LEVEL_LABELS: Record<string, string> = {
  tap_su: 'Tập sự',
  biet_viec: 'Biết việc',
  duoc_viec: 'Được việc',
  dong_gop_ket_qua: 'Đóng góp kết quả',
  tuong: 'Tướng',
}

type CreateLevel = 'tap_su' | 'biet_viec' | 'duoc_viec' | 'dong_gop_ket_qua' | 'tuong'

const LEVEL_FLOW_OPTIONS: Array<{ value: CreateLevel; label: string }> = [
  { value: 'tap_su', label: 'Tập sự' },
  { value: 'biet_viec', label: 'Biết việc' },
  { value: 'duoc_viec', label: 'Được việc' },
  { value: 'dong_gop_ket_qua', label: 'Đóng góp kết quả' },
  { value: 'tuong', label: 'Tướng' },
]

const NEXT_LEVEL_BY_FROM: Record<CreateLevel, CreateLevel> = {
  tap_su: 'biet_viec',
  biet_viec: 'duoc_viec',
  duoc_viec: 'dong_gop_ket_qua',
  dong_gop_ket_qua: 'tuong',
  tuong: 'tuong',
}

export function ManagerClassesScreen() {
  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createMemberQuery, setCreateMemberQuery] = useState('')
  const [debouncedCreateMemberQuery, setDebouncedCreateMemberQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCreateMemberQuery(createMemberQuery), 500)
    return () => clearTimeout(t)
  }, [createMemberQuery])

  const [selectedCreateMembers, setSelectedCreateMembers] = useState<
    Array<{ userId: string; name: string; email: string }>
  >([])

  const [createTeacherQuery, setCreateTeacherQuery] = useState('')
  const [debouncedCreateTeacherQuery, setDebouncedCreateTeacherQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCreateTeacherQuery(createTeacherQuery), 500)
    return () => clearTimeout(t)
  }, [createTeacherQuery])

  const [selectedCreateTeacher, setSelectedCreateTeacher] = useState<{
    userId: string
    name: string
    email: string
  } | null>(null)

  const [editClassId, setEditClassId] = useState<string | null>(null)
  const [editModalTeacherQuery, setEditModalTeacherQuery] = useState('')
  const [debouncedEditModalTeacherQuery, setDebouncedEditModalTeacherQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEditModalTeacherQuery(editModalTeacherQuery), 500)
    return () => clearTimeout(t)
  }, [editModalTeacherQuery])

  const [selectedTeacher, setSelectedTeacher] = useState<{
    userId: string
    name: string
    email: string
  } | null>(null)

  const createForm = useForm<{ name: string; levelFrom: CreateLevel; isKnowledgeWork: boolean }>({
    defaultValues: { name: '', levelFrom: 'tap_su', isKnowledgeWork: true },
  })
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
  } = createForm
  const createLevelFrom = useWatch({ control: createControl, name: 'levelFrom' }) ?? 'tap_su'

  const editForm = useForm<{ name: string; isKnowledgeWork: boolean }>({
    defaultValues: { name: '', isKnowledgeWork: true },
  })
  const { control: editControl, handleSubmit: handleEditSubmit, reset: resetEditForm } = editForm

  const [deleteClassId, setDeleteClassId] = useState<string | null>(null)

  const { data: rows = [], isLoading, isError, error } = useManagerClasses({ search })
  const createClass = useCreateManagerClass()
  const deleteClass = useDeleteManagerClass()
  const updateClass = useUpdateManagerClass()

  const { data: createMemberOptions = [], isFetching: fetchingCreateOptions } =
    useClassMemberOptions(debouncedCreateMemberQuery, undefined, selectedCreateTeacher?.userId)
  const { data: createTeacherOptions = [], isFetching: fetchingCreateTeacherOptions } =
    useTeacherOptions(debouncedCreateTeacherQuery)
  const { data: editModalTeacherOptions = [], isFetching: fetchingEditModalTeacherOptions } =
    useTeacherOptions(debouncedEditModalTeacherQuery)

  useEffect(() => {
    if (!isCreateOpen && !editClassId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isCreateOpen, editClassId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.search-dropdown-container')) {
        if (!selectedCreateTeacher) setCreateTeacherQuery('')
        setCreateMemberQuery('')
        if (!selectedTeacher) setEditModalTeacherQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedCreateTeacher, selectedTeacher])

  const totalMembers = rows.reduce((a, r) => a + r.memberCount, 0)
  const openCount = rows.filter((r) => r.status === 'open').length

  const onCreate = handleCreateSubmit((values) => {
    const n = values.name.trim()
    if (n.length < 3) {
      toast.error('Tên lớp ít nhất 3 ký tự')
      return
    }
    createClass.mutate(
      {
        name: n,
        levelFrom: values.levelFrom,
        levelTo: NEXT_LEVEL_BY_FROM[values.levelFrom],
        status: 'open',
        memberUserIds: [],
        teacherUserId: selectedCreateTeacher?.userId ?? null,
        isKnowledgeWork: values.isKnowledgeWork,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false)
          setCreateMemberQuery('')
          setSelectedCreateMembers([])
          resetCreateForm({ name: '', levelFrom: 'tap_su', isKnowledgeWork: true })
          setCreateTeacherQuery('')
          setSelectedCreateTeacher(null)
        },
      }
    )
  })

  const closeEditClassModal = () => {
    setEditClassId(null)
    resetEditForm({ name: '' })
    setEditModalTeacherQuery('')
    setSelectedTeacher(null)
  }

  const openEditClassModal = (row: (typeof rows)[number]) => {
    setEditClassId(row.id)
    resetEditForm({ name: row.name, isKnowledgeWork: row.isKnowledgeWork ?? true })
    setSelectedTeacher(row.teacher ?? null)
    setEditModalTeacherQuery('')
  }

  const saveEditClass = handleEditSubmit((values) => {
    if (!editClassId) return
    const n = values.name.trim()
    if (n.length < 3) {
      toast.error('Tên lớp ít nhất 3 ký tự')
      return
    }
    updateClass.mutate(
      {
        classId: editClassId,
        input: {
          name: n,
          teacherUserId: selectedTeacher?.userId ?? null,
          isKnowledgeWork: values.isKnowledgeWork,
        },
      },
      {
        onSuccess: () => {
          closeEditClassModal()
        },
      }
    )
  })

  const handleDeleteClass = (id: string) => {
    setDeleteClassId(id)
  }

  return (
    <>
      <ManagerScreenLayout hideHubNav hideToolbar>
        <div className="mb-8 flex flex-col gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className={cn('min-w-0 flex-1')}>
              <h1 className="text-2xl font-bold text-foreground">Chia lớp học</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-card px-3 py-2.5 text-sm font-semibold text-foreground shadow-sm ring-1 ring-primary/10">
                <Calendar className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                Học kỳ Q2 / 2026
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div
              className={cn(
                'flex items-center gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-[var(--shadow-card)]',
                CARD_ENTRANCE_HOVER
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary">
                <Users className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Lớp đang mở
                </div>
                <div className="text-2xl font-bold text-foreground">{openCount}</div>
              </div>
            </div>
            <div
              className={cn(
                'flex items-center gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-[var(--shadow-card)]',
                CARD_ENTRANCE_HOVER
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <UserPlus2 className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Tổng học viên
                </div>
                <div className="text-2xl font-bold text-foreground">{totalMembers}</div>
              </div>
            </div>
            <div
              className={cn(
                'flex items-center gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-[var(--shadow-card)]',
                CARD_ENTRANCE_HOVER
              )}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Calendar className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Lớp trong kỳ
                </div>
                <div className="text-2xl font-bold text-foreground">{rows.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-stretch">
          <div className="group relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-muted-foreground group-focus-within:text-primary"
              strokeWidth={2}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên lớp, ví dụ: Tập sự — Đợt Q2/2026"
              className="h-auto w-full rounded-xl border border-transparent bg-muted/80 py-3 pl-11 pr-4 text-sm shadow-inner shadow-none outline-none ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex shrink-0 gap-3">
            <Button
              type="button"
              className="gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-md"
              onClick={() => setIsCreateOpen((v) => !v)}
            >
              <PlusCircle className="h-4 w-4" strokeWidth={2} />
              Tạo lớp
            </Button>
          </div>
        </div>

        {isCreateOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-class-modal-title"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/35 backdrop-blur-sm"
                aria-label="Đóng"
                onClick={() => setIsCreateOpen(false)}
              />
              <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
                <div
                  className="relative z-10 my-auto w-full max-w-2xl max-h-[min(90vh,800px)] overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 id="create-class-modal-title" className="text-lg font-bold text-foreground">
                      Tạo lớp học mới
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded p-1 text-muted-foreground hover:bg-muted"
                      onClick={() => setIsCreateOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Form {...createForm}>
                    <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onCreate}>
                      <InputController
                        control={createControl}
                        name="name"
                        label="Tên lớp"
                        required
                        placeholder="Ví dụ: Tập sự — Đợt Q2/2026"
                        className="md:col-span-2"
                      />
                      <SelectController
                        control={createControl}
                        name="levelFrom"
                        label="Cấp lớp"
                        required
                      >
                        {LEVEL_FLOW_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectController>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Lộ trình
                        </label>
                        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm font-medium text-foreground">
                          {LEVEL_LABELS[createLevelFrom]} →{' '}
                          {LEVEL_LABELS[NEXT_LEVEL_BY_FROM[createLevelFrom]]}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 py-2 md:col-span-2">
                        <Controller
                          control={createControl}
                          name="isKnowledgeWork"
                          render={({ field }) => (
                            <Checkbox
                              id="isKnowledgeWork"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <label
                          htmlFor="isKnowledgeWork"
                          className="text-sm font-semibold text-foreground cursor-pointer select-none"
                        >
                          Lớp Lao động tri thức
                        </label>
                      </div>
                      <div className="search-dropdown-container relative md:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Giáo viên phụ trách lớp
                        </label>
                        <Input
                          value={
                            selectedCreateTeacher ? selectedCreateTeacher.name : createTeacherQuery
                          }
                          onChange={(e) => {
                            setCreateTeacherQuery(e.target.value)
                            if (selectedCreateTeacher) setSelectedCreateTeacher(null)
                          }}
                          placeholder="Gõ tên/email giáo viên..."
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                        />
                        {!selectedCreateTeacher && createTeacherQuery.trim().length > 0 && (
                          <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border bg-white p-1 shadow-lg">
                            {fetchingCreateTeacherOptions ? (
                              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Tìm...
                              </div>
                            ) : createTeacherOptions.length === 0 ? (
                              <div className="px-2 py-2 text-xs text-muted-foreground">
                                Không có kết quả
                              </div>
                            ) : (
                              createTeacherOptions.map((opt) => (
                                <Button
                                  key={opt.userId}
                                  type="button"
                                  variant="ghost"
                                  className="flex h-auto w-full flex-col items-start rounded px-2 py-2 text-left text-xs font-normal"
                                  onMouseDown={() => {
                                    setSelectedCreateTeacher(opt)
                                    setCreateTeacherQuery('')
                                  }}
                                >
                                  <p className="font-semibold text-foreground">{opt.name}</p>
                                  <p className="text-muted-foreground">{opt.email}</p>
                                </Button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {false ? (
                        <>
                          <div className="search-dropdown-container relative md:col-span-2">
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                              Thêm nhân sự cho lớp (theo cấp đã chọn)
                            </label>
                            <div className="relative">
                              <Input
                                value={createMemberQuery}
                                onChange={(e) => setCreateMemberQuery(e.target.value)}
                                placeholder="Gõ tên/email để tìm nhân sự..."
                                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm shadow-none outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                              />
                              {createMemberQuery.trim().length > 0 && (
                                <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border bg-white p-1 shadow-lg">
                                  {fetchingCreateOptions ? (
                                    <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Đang tìm...
                                    </div>
                                  ) : createMemberOptions.filter(
                                      (opt) =>
                                        !selectedCreateMembers.some(
                                          (m) => m.userId === opt.userId
                                        ) && opt.userId !== selectedCreateTeacher?.userId
                                    ).length === 0 ? (
                                    <div className="px-2 py-2 text-xs text-muted-foreground">
                                      Không có kết quả phù hợp
                                    </div>
                                  ) : (
                                    createMemberOptions
                                      .filter(
                                        (opt) =>
                                          !selectedCreateMembers.some(
                                            (m) => m.userId === opt.userId
                                          ) && opt.userId !== selectedCreateTeacher?.userId
                                      )
                                      .map((opt) => (
                                        <Button
                                          key={opt.userId}
                                          type="button"
                                          variant="ghost"
                                          className="flex h-auto w-full flex-col items-start rounded px-2 py-2 text-left text-xs font-normal hover:bg-primary/10"
                                          onMouseDown={() => {
                                            setSelectedCreateMembers((prev) => [...prev, opt])
                                            setCreateMemberQuery('')
                                          }}
                                        >
                                          <p className="font-semibold text-foreground">
                                            {opt.name}
                                          </p>
                                          <p className="text-muted-foreground">{opt.email}</p>
                                        </Button>
                                      ))
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <p className="mb-1 text-xs font-semibold text-muted-foreground">
                              Nhân sự đã chọn ({selectedCreateMembers.length})
                            </p>
                            {selectedCreateMembers.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Chưa chọn nhân sự nào.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {selectedCreateMembers.map((m) => (
                                  <span
                                    key={m.userId}
                                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs"
                                  >
                                    {m.name}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 min-h-0 shrink-0 rounded p-0.5 hover:bg-primary/20"
                                      onClick={() =>
                                        setSelectedCreateMembers((prev) =>
                                          prev.filter((x) => x.userId !== m.userId)
                                        )
                                      }
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      ) : null}
                      <div className="rounded-xl border border-dashed border-primary/20 bg-primary/5 px-3 py-2.5 text-xs font-semibold text-primary md:col-span-2">
                        Học viên sẽ tự đăng ký lớp sau khi lớp được tạo. Giáo viên phụ trách duyệt
                        hoặc từ chối từng đăng ký.
                      </div>
                      <div className="mt-5 flex justify-end gap-2 md:col-span-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateOpen(false)}
                          disabled={createClass.isPending}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="submit"
                          className="gap-2 font-bold"
                          disabled={createClass.isPending}
                        >
                          Tạo lớp
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            </div>,
            document.body
          )}

        {isError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <p className="font-semibold">Không thể tải danh sách lớp</p>
            <p className="mt-1 text-xs opacity-80">
              {error instanceof Error
                ? error.message
                : 'Lỗi không xác định. Kiểm tra quyền truy cập hoặc kết nối mạng.'}
            </p>
          </div>
        )}

        {isLoading && !isError && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Đang tải danh sách lớp...</span>
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-semibold text-muted-foreground">Chưa có lớp học nào</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Nhấn "Tạo lớp" để tạo lớp học đầu tiên.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 items-start md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <ClassCard
              key={row.id}
              row={row}
              onEdit={openEditClassModal}
              onDelete={handleDeleteClass}
            />
          ))}
        </div>

        {editClassId &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-class-modal-title"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/35 backdrop-blur-sm"
                aria-label="Đóng"
                onClick={closeEditClassModal}
              />
              <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
                <div
                  className="relative z-10 my-auto w-full max-w-lg max-h-[min(90vh,640px)] overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 id="edit-class-modal-title" className="text-lg font-bold text-foreground">
                      Chỉnh sửa lớp học
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded p-1 text-muted-foreground hover:bg-muted"
                      onClick={closeEditClassModal}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Form {...editForm}>
                    <form className="space-y-4" onSubmit={saveEditClass}>
                      <InputController control={editControl} name="name" label="Tên lớp" required />
                      <div className="search-dropdown-container relative">
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Giáo viên phụ trách
                        </label>
                        <Input
                          value={selectedTeacher ? selectedTeacher.name : editModalTeacherQuery}
                          onChange={(e) => {
                            setEditModalTeacherQuery(e.target.value)
                            if (selectedTeacher) setSelectedTeacher(null)
                          }}
                          placeholder="Gõ tên/email để đổi giáo viên..."
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                        />
                        {!selectedTeacher && editModalTeacherQuery.trim().length > 0 && (
                          <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border bg-white p-1 shadow-lg">
                            {fetchingEditModalTeacherOptions ? (
                              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Tìm...
                              </div>
                            ) : editModalTeacherOptions.length === 0 ? (
                              <div className="px-2 py-2 text-xs text-muted-foreground">
                                Không có kết quả
                              </div>
                            ) : (
                              editModalTeacherOptions.map((opt) => (
                                <Button
                                  key={opt.userId}
                                  type="button"
                                  variant="ghost"
                                  className="flex h-auto w-full flex-col items-start rounded px-2 py-2 text-left text-xs font-normal"
                                  onMouseDown={() => {
                                    setSelectedTeacher(opt)
                                    setEditModalTeacherQuery('')
                                  }}
                                >
                                  <p className="font-semibold text-foreground">{opt.name}</p>
                                  <p className="text-muted-foreground">{opt.email}</p>
                                </Button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 py-2">
                        <Controller
                          control={editControl}
                          name="isKnowledgeWork"
                          render={({ field }) => (
                            <Checkbox
                              id="editIsKnowledgeWork"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <label
                          htmlFor="editIsKnowledgeWork"
                          className="text-sm font-semibold text-foreground cursor-pointer select-none"
                        >
                          Lớp Lao động tri thức
                        </label>
                      </div>
                      <div className="mt-5 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={closeEditClassModal}
                        >
                          Hủy
                        </Button>
                        <Button type="submit" className="font-bold">
                          Lưu thay đổi
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            </div>,
            document.body
          )}
      </ManagerScreenLayout>

      <ConfirmDialog
        open={deleteClassId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteClassId(null)
        }}
        title="Xóa lớp học?"
        description="Thao tác này không thể hoàn tác. Tất cả thành viên sẽ bị xóa khỏi lớp."
        confirmLabel="Xóa lớp"
        destructive
        onConfirm={() => {
          if (deleteClassId) deleteClass.mutate(deleteClassId)
          setDeleteClassId(null)
        }}
      />
    </>
  )
}
