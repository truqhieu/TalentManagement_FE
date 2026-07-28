import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { SkeletonSubmissionCardList } from '@/components/ui/skeleton'
import { useMyLearningMaterials } from '@/features/learning-materials/hooks'
import { BookOpen, Link as LinkIcon, Upload } from 'lucide-react'

export function MyLearningMaterialsList() {
  const { data: materials = [], isLoading } = useMyLearningMaterials()

  if (isLoading) return <SkeletonSubmissionCardList count={2} />
  if (materials.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-8 w-8" />}
        title="Chưa có tài liệu học"
        description="Giáo viên/quản lý sẽ cập nhật tài liệu học cho lớp của bạn tại đây."
        className="border border-[#006C49]/20 bg-[#006C49]/0.2 rounded-3xl"
      />
    )
  }

  return (
    <div className="space-y-2">
      {materials.map((m) => (
        <Card key={m.id} className="p-3">
          <p className="text-sm font-semibold text-foreground">{m.title}</p>
          {m.note ? <p className="mt-1 text-xs text-muted-foreground">{m.note}</p> : null}
          {m.url ? (
            <a
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <LinkIcon className="h-3 w-3" />
              {m.url}
            </a>
          ) : null}
          {m.fileRef ? (
            <a
              href={m.fileRef}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Upload className="h-3 w-3" />
              Tải tài liệu
            </a>
          ) : null}
        </Card>
      ))}
    </div>
  )
}
