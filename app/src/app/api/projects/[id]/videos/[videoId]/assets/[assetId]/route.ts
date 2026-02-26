import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRunningHubApiKey } from '@/lib/config'

interface Props {
  params: Promise<{ id: string; videoId: string; assetId: string }>
}

// Get asset status/details
export async function GET(request: Request, { params }: Props) {
  const { assetId } = await params

  const asset = await prisma.videoAsset.findUnique({
    where: { id: assetId },
    include: { video: true }
  })

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  // If asset has URL, it's complete
  if (asset.url) {
    return NextResponse.json({
      id: asset.id,
      type: asset.type,
      status: 'SUCCESS',
      url: asset.url,
      duration: asset.duration,
      aspectRatio: asset.aspectRatio,
      prompt: asset.prompt,
      version: asset.version,
    })
  }

  // If no task ID, something went wrong
  if (!asset.taskId) {
    return NextResponse.json({
      id: asset.id,
      type: asset.type,
      status: 'FAILED',
      error: 'No task ID found',
    })
  }

  // Poll RunningHub for status (two-step: status then outputs)
  try {
    const apiKey = await getRunningHubApiKey()
    const taskId = asset.taskId

    // Step 1: Query task status
    console.log('[Asset Status] Querying task status', { assetId, taskId, type: asset.type })

    const statusResponse = await fetch('https://www.runninghub.cn/task/openapi/status', {
      method: 'POST',
      headers: {
        'Host': 'www.runninghub.cn',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey, taskId }),
    })

    const statusData = await statusResponse.json()

    console.log('[Asset Status] Status response', {
      taskId,
      code: statusData.code,
      status: statusData.data,
      msg: statusData.msg,
    })

    if (statusData.code !== 0) {
      return NextResponse.json({
        id: asset.id,
        type: asset.type,
        status: 'FAILED',
        error: statusData.msg || 'Failed to query task status',
      })
    }

    const taskStatus = statusData.data // "QUEUED" | "RUNNING" | "FAILED" | "SUCCESS"

    if (taskStatus === 'QUEUED' || taskStatus === 'RUNNING') {
      return NextResponse.json({
        id: asset.id,
        type: asset.type,
        status: taskStatus,
        taskId,
      })
    }

    if (taskStatus === 'FAILED') {
      return NextResponse.json({
        id: asset.id,
        type: asset.type,
        status: 'FAILED',
        error: 'Task failed on RunningHub',
      })
    }

    // Step 2: On SUCCESS, fetch outputs
    if (taskStatus === 'SUCCESS') {
      console.log('[Asset Status] Getting task outputs', { taskId })

      const outputsResponse = await fetch('https://www.runninghub.cn/task/openapi/outputs', {
        method: 'POST',
        headers: {
          'Host': 'www.runninghub.cn',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey, taskId }),
      })

      const outputsData = await outputsResponse.json()

      console.log('[Asset Status] Outputs response', {
        taskId,
        code: outputsData.code,
        msg: outputsData.msg,
        dataCount: outputsData.data?.length || 0,
      })

      if (outputsData.code !== 0) {
        return NextResponse.json({
          id: asset.id,
          type: asset.type,
          status: 'FAILED',
          error: outputsData.msg || 'Failed to get task outputs',
        })
      }

      const url = outputsData.data?.[0]?.fileUrl

      if (!url) {
        return NextResponse.json({
          id: asset.id,
          type: asset.type,
          status: 'FAILED',
          error: 'No URL in outputs response',
        })
      }

      console.log('[Asset Status] Success, URL:', url)

      // Update asset with URL
      const updatedAsset = await prisma.videoAsset.update({
        where: { id: assetId },
        data: { url, taskId: null },
      })

      return NextResponse.json({
        id: updatedAsset.id,
        type: updatedAsset.type,
        status: 'SUCCESS',
        url: updatedAsset.url,
        duration: updatedAsset.duration,
        aspectRatio: updatedAsset.aspectRatio,
        prompt: updatedAsset.prompt,
        version: updatedAsset.version,
      })
    }

    // Unknown status
    return NextResponse.json({
      id: asset.id,
      type: asset.type,
      status: taskStatus,
      taskId,
    })
  } catch (error) {
    console.error('[Asset Status] Error polling task', error)
    return NextResponse.json({
      id: asset.id,
      type: asset.type,
      status: 'UNKNOWN',
      taskId: asset.taskId,
    })
  }
}

// Delete an asset
export async function DELETE(request: Request, { params }: Props) {
  const { assetId } = await params

  await prisma.videoAsset.delete({
    where: { id: assetId }
  })

  return NextResponse.json({ success: true })
}
