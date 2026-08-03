import { PAGE_HEADER_TITLE } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import {
  CompanyLandingSettingsForm,
  type CompanyLandingSettingsFormHandle,
} from '@/features/landing/CompanyLandingSettingsForm'
import {
  fetchCompanyLandingPublic,
  putCompanyLandingContent,
} from '@/features/landing/companyLandingApi'
import { DEFAULT_COMPANY_LANDING_CONTENT } from '@/features/landing/landingContent.defaults'
import { mergeCompanyLandingContent } from '@/features/landing/landingContent.merge'
import type { CompanyLandingContent } from '@/features/landing/landingContent.types'
import { getApiErrorMessage } from '@/lib/axios'
import { cn } from '@/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

export function CompanyLandingSettingsScreen() {
  const qc = useQueryClient()
  const formRef = useRef<CompanyLandingSettingsFormHandle>(null)
  const [saveTick, setSaveTick] = useState(0)
  const {
    data: patch,
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: ['company-landing', 'public'],
    queryFn: fetchCompanyLandingPublic,
  })
  const merged = useMemo(
    () => mergeCompanyLandingContent(DEFAULT_COMPANY_LANDING_CONTENT, patch ?? undefined),
    [patch]
  )

  const save = useMutation({
    mutationFn: async (content: CompanyLandingContent) => {
      await putCompanyLandingContent(content as unknown as Record<string, unknown>)
    },
    onSuccess: async () => {
      toast.success('Đã lưu nội dung landing')
      await qc.invalidateQueries({ queryKey: ['company-landing', 'public'] })
      await qc.refetchQueries({ queryKey: ['company-landing', 'public'] })
      setSaveTick((t) => t + 1)
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e))
    },
  })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="">
        <div className={cn('min-w-0 flex-1 py-2')}>
          <h1 className={PAGE_HEADER_TITLE}>
            <span className="text-2xl font-bold">Trang giới thiệu công ty</span>
          </h1>
          <p className="text-sm text-gray-500">
            Chỉnh sửa nội dung hiển thị tại trang chủ công khai (/) bằng các ô nhập có nhãn. Ảnh có
            thể tải lên máy chủ (hiển thị xem trước ngay trên form) hoặc dùng đường dẫn tĩnh trong
            dự án (ví dụ /Image_VCB/...). Sau khi lưu, mọi người sẽ thấy bản mới khi tải lại trang.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => formRef.current?.submit()}
            loading={save.isPending}
            disabled={save.isPending || isLoading}
          >
            {save.isPending ? 'Đang lưu…' : 'Lưu lên máy chủ'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => formRef.current?.restoreDefault()}
            disabled={isLoading}
          >
            Khôi phục bản mặc định (chưa lưu)
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href="/" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 size-4" aria-hidden />
              Xem trang chủ
            </a>
          </Button>
        </div>

        <CompanyLandingSettingsForm
          ref={formRef}
          merged={merged}
          saveTick={saveTick}
          landingFetched={isFetched}
          onValidSubmit={(data) => save.mutate(data)}
        />
      </div>
    </div>
  )
}
