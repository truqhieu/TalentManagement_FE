import { PageHeader } from '@/components/shared/PageHeader'
import { MemberClassesPanel } from '@/features/learning-path/components/MemberLearningPathViews'
import { MyLearningMaterialsList } from '@/features/learning-materials/components/MyLearningMaterialsList'
import { EditorClassesSection } from '@/features/editor-classes/components/EditorClassesSection'
import { usePermission } from '@/hooks/usePermission'

export function MemberLearningClassesScreen({ isOther = false }: { isOther?: boolean }) {
  const { canId } = usePermission()

  return (
    <>
      <PageHeader
        title={isOther ? 'Lớp học khác' : 'Lớp học của tôi'}
        // description={
        //   isOther
        //     ? 'Danh sách các lớp học khác bạn tham gia (ngoài lộ trình Lao động tri thức) và lịch học buổi do giáo viên cập nhật.'
        //     : 'Trong mỗi kỳ, mỗi nhân sự chỉ được xếp một lớp. Bảng bên dưới hiển thị lớp hiện tại của bạn và lịch học buổi do giáo viên cập nhật.'
        // }
      />
      <div className="pb-6">
        <MemberClassesPanel isOther={isOther} />
      </div>
      {isOther ? (
        <div className="pb-6">
          <h2 className="mb-3 text-sm font-bold text-foreground">Tài liệu học</h2>
          <MyLearningMaterialsList />
        </div>
      ) : null}
      {isOther && canId('manager.classes') ? (
        <div className="pb-6">
          <EditorClassesSection />
        </div>
      ) : null}
    </>
  )
}
