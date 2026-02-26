import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  redirect(`/project/${id}/script`)
}
