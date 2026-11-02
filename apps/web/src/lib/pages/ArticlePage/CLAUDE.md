# ArticlePage

One published post. A game article shows the game it is about in a panel beside the text; site
news shows the latest posts there instead. Public.

## Routes

- `/news/[slug]` — `src/app/news/[slug]/page.tsx`.
- ISR: `revalidate = 3600`, `generateStaticParams()` returns `[]`. The admin editor purges a post
  with `revalidateArticlePage` (`entities/article/api/article.actions.ts`) after every save and
  delete.
- The route loads the post with `fetchOrNull(articlesAPI.getBySlug)` inside `React.cache`; a
  missing or unpublished post is `notFound()` from the page component, and `generateMetadata`
  returns neutral metadata when the request fails.
- Metadata: title, description from the summary, canonical `/news/<slug>`, a full Open Graph
  block (`type: article`, `publishedTime`, `modifiedTime`, the post image or the game cover,
  `og-default.png` otherwise). JSON-LD: `Article` and `BreadcrumbList`.

## Data

- A game article: the full game through `gamesApi.getByIds({ _ids: [id] })` and its player
  counts through `gamesApi.getStats`, both server-side.
- Site news: the four latest posts (`articlesAPI.getArticles({ take: 4 })`), minus this one.
- Comments load on the client from `GET /articles/:articleId/comments` through
  `widgets/news/ArticleComments`; nothing of them is in the server render.
- On the client, every open registers a view: `useRegisterArticleViewMutation` posts
  `POST /articles/:id/views` once per mount, silently (`isSilent`, a failure toasts nothing). The
  API counts one view per visitor per 30 minutes, so reloads in a row do not inflate it.
- An admin's count comes from `useAdminArticleQuery(article._id)` — the only response that carries
  `views` — enabled once the view request has settled, so the number includes this open.

## Composition

1. `BGImage` with the game, or the default one for site news.
2. A grid capped at `--article-page-width` with areas `head side / body side / comments side`;
   below `media960` it stacks `head / side / body / comments` for a game article and
   `head / body / comments / side` for site news.
3. Head `Box`: `Breadcrumbs`, a meta row (`Badge` with the kind, date, reading time; for admins
   the view count and "Edit post", pushed to the right), the `h1`, the summary, the author with
   `Avatar`.
4. Side: `widgets/news/ArticleGamePanel`, or a `Box` "Latest posts" with `ArticleLinks`.
5. Body `Box`: the post image (or the game's first artwork) and `RichText size="article"`.
6. `widgets/news/ArticleComments`: a "Comments" `Box` (`id="comments"`) with
   `features/comments/ui/CommentThread` for the post — the same editor, votes, reports and
   moderation as game comments. Guests read the comments and get "Sign in to join the
   discussion" instead of the form.

## Rules and gotchas

- **Load the game with `getByIds`, not `getById`.** `GET /games/by-id/:id` reads `_id` from the
  query string while `gamesApi.getById` sends it in the path, so it answers 400 and the panel
  disappears.
- **An adult game hides its media for viewers who hide adult content**: the cover in the panel,
  the background and the post image (`getArticleImage`, `isArticleMediaHidden`). The text stays.
- **"Edit post" waits for `useIsAuthHydrated`**, like every admin control read from the persisted
  auth store.
- **The view count is never part of the route's data.** The page is ISR, so anything the server
  render reads is cached in the HTML every visitor gets; `GET /articles/by-slug` does not return
  `views`, and the count is loaded on the client for admins only.
- Panel padding is `--article-box-padding`, which drops to `--padding-x3` below 768px; pass it
  through `contentStyle`, never a class on `Box`'s content.
- **The comments are deferred (`CommentThread isDeferred`).** They are fetched and the `/comments`
  socket is followed only once the panel comes within 400px of the screen, so a reader who never
  scrolls down opens no connection. The route is ISR, so they could not be server-rendered
  anyway.
- **`#comments` (the link of every notification about a post comment) is scrolled to by
  `ArticleComments` itself**, in an effect, as `GameCommunity` does for `#discussion`: the page
  scrolls `#page-scroll`, not the document, and the browser's own fragment jump left the post at
  the top. `scroll-margin-top: var(--container-padding-top)` on the panel keeps its heading clear
  of the header.
- **The article is deliberately narrower than the news feed.** The grid is capped at
  `--article-page-width` (1080px, the side panel included) so the text keeps a readable measure;
  `NewsPage` has no cap and fills the page container. Do not reuse the token for a feed, and do
  not drop the cap here — a post rendered at 1360px gives lines well past a comfortable measure.
- **The side panel sticks below the header, not at the top of the scrollport.**
  `top: var(--container-padding-top)` is the container's own top padding (the header plus the
  gap), and it follows `.container_topMenu`/`.container_bare`. With `top: 0` the panel slid under
  the fixed header, which cut off the top of "The game in this article" as the page scrolled.
