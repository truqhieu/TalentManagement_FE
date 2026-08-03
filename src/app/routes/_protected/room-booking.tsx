import { createFileRoute } from '@tanstack/react-router'
import RoomBookingPage from '@/features/room-booking/RoomBookingPage'

import { z } from 'zod'

const roomBookingSearchSchema = z.object({
  room: z.string().optional(),
})

export const Route = createFileRoute('/_protected/room-booking')({
  validateSearch: (search) => roomBookingSearchSchema.parse(search),
  component: RoomBookingPage,
})
