import Link from 'next/link'
import { Coffee } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function QuickAddCoffeeLink() {
  return (
    <Link href="/coffee/add?from=today" className="block group">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coffee className="h-4 w-4 text-gray-400" />
            <CardTitle>Log Coffee</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Tap to log a coffee or espresso.</p>
          <span className="mt-3 inline-block text-sm font-medium text-blue-600 group-hover:underline">
            Open →
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
