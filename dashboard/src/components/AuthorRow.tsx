import { Author } from '../types/author'
import { formatTimeAgo } from '../utils/time'

interface AuthorRowProps {
  author: Author
}

export default function AuthorRow({ author }: AuthorRowProps) {
  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-zinc-100 hover:border-zinc-200 transition-colors">
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center flex-shrink-0">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt={author.name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <span className="text-zinc-500 font-semibold text-lg">
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
            className="font-semibold text-lg text-zinc-900 hover:text-primary"
          >
            {author.name}
          </a>

          {author.status === 'error' && (
            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
              Feed Error
            </span>
          )}

          {author.status === 'inactive' && (
            <span className="px-2 py-0.5 text-xs bg-zinc-100 text-zinc-600 rounded">
              Inactive
            </span>
          )}
        </div>

        {author.bio && (
          <p className="text-zinc-600 mt-1 line-clamp-2">
            {author.bio}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500 flex-wrap">
          <span className="font-medium text-zinc-700">
            {formatTimeAgo(author.lastPublished)}
          </span>

          <span>
            {author.articleCount} {author.articleCount === 1 ? 'article' : 'articles'}
          </span>

          {author.categories.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {author.categories.slice(0, 3).map((category) => (
                <span
                  key={category}
                  className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-xs"
                >
                  {category}
                </span>
              ))}
              {author.categories.length > 3 && (
                <span className="text-xs text-zinc-400">
                  +{author.categories.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="flex items-center gap-3 mt-3">
          <a
            href={author.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Visit site
          </a>
          <a
            href={author.feedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            RSS Feed
          </a>
        </div>
      </div>
    </div>
  )
}
