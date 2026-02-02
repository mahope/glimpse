"use client"
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function ReportPreview({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Preview</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[80vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4">
          <DialogTitle>Report Preview</DialogTitle>
        </DialogHeader>
        <iframe src={`/api/sites/${siteId}/report`} className="w-full h-full border-t" />
      </DialogContent>
    </Dialog>
  )
}
