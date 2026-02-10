import { Author } from '../types/author'
import { formatTimeAgo } from '../utils/time'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AuthorRowProps {
  author: Author
}

export default function AuthorRow({ author }: AuthorRowProps) {
  return (
    <Card hover className="transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {author.avatarUrl ? (
              <img
                src={author.avatarUrl}
                alt={author.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <span className="text-muted-foreground font-semibold text-lg">
                {author.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={author.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-lg text-foreground hover:text-primary transition-colors"
              >
                {author.name}
              </a>

              {author.status === 'error' && (
                <Badge variant="destructive" className="text-xs">
                  Feed Error
                </Badge>
              )}

              {author.status === 'inactive' && (
                <Badge variant="secondary" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>

            {author.bio && (
              <p className="text-muted-foreground mt-1 line-clamp-2">
                {author.bio}
              </p>
            )}

            {/* Metadata row */}
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
              <span className="font-medium text-foreground">
                {formatTimeAgo(author.lastPublished)}
              </span>

              <span className="tabular-nums">
                {author.articleCount} {author.articleCount === 1 ? 'article' : 'articles'}
              </span>

              {author.categories.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {author.categories.slice(0, 3).map((category) => (
                    <Badge key={category} variant="outline" className="text-xs">
                      {category}
                    </Badge>
                  ))}
                  {author.categories.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{author.categories.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Links */}
            <div className="flex items-center gap-4 mt-3">
              <a
                href={author.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Visit site
              </a>
              <a
                href={author.feedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                RSS Feed
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
