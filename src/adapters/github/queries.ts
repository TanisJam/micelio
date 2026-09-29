/**
 * GraphQL documents for the GitHub adapter. Kept as plain strings (not a
 * codegen artifact) since the query surface is small and stable.
 */

/** Commits for a merged PR: `$commitsPerPr`-capped, with both authored/committed dates for `firstCommitTime`. */
export const PR_COMMITS_FRAGMENT = /* GraphQL */ `
  fragment PrCommitsFields on PullRequest {
    commits(first: $commitsPerPr) {
      totalCount
      nodes {
        commit {
          oid
          messageHeadline
          authoredDate
          committedDate
          url
          author {
            name
            user {
              login
              avatarUrl
            }
          }
        }
      }
    }
  }
`

/** Commits for an open/closed PR: `$secondaryCommitsPerPr`-capped (lower than merged -- see `caps.ts`). */
export const SECONDARY_PR_COMMITS_FRAGMENT = /* GraphQL */ `
  fragment SecondaryPrCommitsFields on PullRequest {
    commits(first: $secondaryCommitsPerPr) {
      totalCount
      nodes {
        commit {
          oid
          messageHeadline
          authoredDate
          committedDate
          url
          author {
            name
            user {
              login
              avatarUrl
            }
          }
        }
      }
    }
  }
`

export const MERGED_PR_FRAGMENT = /* GraphQL */ `
  fragment MergedPrFields on PullRequest {
    number
    title
    url
    createdAt
    mergedAt
    baseRefName
    headRefName
    additions
    deletions
    changedFiles
    author {
      login
      avatarUrl
    }
    labels(first: 10) {
      nodes {
        name
      }
    }
    ...PrCommitsFields
  }
`

export const CLOSED_PR_FRAGMENT = /* GraphQL */ `
  fragment ClosedPrFields on PullRequest {
    number
    title
    url
    createdAt
    closedAt
    baseRefName
    headRefName
    author {
      login
      avatarUrl
    }
    ...SecondaryPrCommitsFields
  }
`

export const OPEN_PR_FRAGMENT = /* GraphQL */ `
  fragment OpenPrFields on PullRequest {
    number
    title
    url
    createdAt
    baseRefName
    headRefName
    author {
      login
      avatarUrl
    }
    ...SecondaryPrCommitsFields
  }
`

/**
 * A release's tag target, drilled through an annotated tag object when
 * needed, to cheaply recover the commit `oid` it points at.
 */
const RELEASE_TAG_TARGET_FIELDS = /* GraphQL */ `
  tag {
    target {
      ... on Commit {
        oid
      }
      ... on Tag {
        target {
          ... on Commit {
            oid
          }
        }
      }
    }
  }
`

// Closed-unmerged PRs and merged PRs are deliberately NOT fetched here:
// bundling paginated, commit-bearing connections into one big overview query
// (the original shape) pushed its cost/latency high enough to trigger
// intermittent upstream 502/504s on repositories with substantial PR
// history (observed while generating fixtures), and serialized the start of
// merged-PR pagination behind this query's own (non-trivial) latency.
// Unit 1 (cold-fetch time budget): this is now a small, cheap, single-page
// "meta" query -- repo info, languages, releases/tags, branches, open PRs --
// with NO paginated connection of its own, so it can run fully concurrently
// with the independent merged-PR (`MERGED_PRS_PAGE_QUERY`), closed-PR
// (`CLOSED_PRS_PAGE_QUERY`) and, since Unit 2, direct-commit-history
// (`DIRECT_COMMITS_PAGE_QUERY`) pagination loops instead of gating their
// start. The default-branch commit-history scan (used to find direct,
// non-PR commits) moved out to its own paginated query in Unit 2, for the
// same reason merged/closed PRs already have their own.
export const REPO_META_QUERY = /* GraphQL */ `
  ${SECONDARY_PR_COMMITS_FRAGMENT}
  ${OPEN_PR_FRAGMENT}
  query RepoMeta(
    $owner: String!
    $name: String!
    $secondaryCommitsPerPr: Int!
  ) {
    repository(owner: $owner, name: $name) {
      name
      description
      url
      stargazerCount
      forkCount
      createdAt
      pushedAt
      defaultBranchRef {
        name
      }
      licenseInfo {
        name
      }
      languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
        edges {
          size
          node {
            name
            color
          }
        }
      }
      releases(first: 100, orderBy: { field: CREATED_AT, direction: ASC }) {
        totalCount
        nodes {
          name
          tagName
          url
          publishedAt
          createdAt
          ${RELEASE_TAG_TARGET_FIELDS}
        }
      }
      tags: refs(refPrefix: "refs/tags/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: ASC }) {
        nodes {
          name
          target {
            ... on Commit {
              oid
              committedDate
              url
            }
            ... on Tag {
              tagger {
                date
              }
              target {
                ... on Commit {
                  oid
                  committedDate
                  url
                }
              }
            }
          }
        }
      }
      branches: refs(refPrefix: "refs/heads/", first: 100, orderBy: { field: ALPHABETICAL, direction: ASC }) {
        nodes {
          name
          target {
            ... on Commit {
              committedDate
            }
          }
        }
      }
      openPRs: pullRequests(states: OPEN, first: 50, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes {
          ...OpenPrFields
        }
      }
    }
  }
`

// Unit 1: `totalCount` is requested on every page (not just the first) --
// GitHub returns the same connection-wide value regardless of cursor, at
// negligible extra cost, so there's no need to special-case "only ask on
// page 1". Used to report an honest "N of totalCount" truncation note when
// the time budget (see `fetchRepoSnapshot.ts`) stops pagination early.
export const MERGED_PRS_PAGE_QUERY = /* GraphQL */ `
  ${PR_COMMITS_FRAGMENT}
  ${MERGED_PR_FRAGMENT}
  query MergedPrsPage(
    $owner: String!
    $name: String!
    $prPageSize: Int!
    $commitsPerPr: Int!
    $after: String
  ) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        states: MERGED
        first: $prPageSize
        after: $after
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ...MergedPrFields
        }
      }
    }
  }
`

export const CLOSED_PRS_PAGE_QUERY = /* GraphQL */ `
  ${SECONDARY_PR_COMMITS_FRAGMENT}
  ${CLOSED_PR_FRAGMENT}
  query ClosedPrsPage(
    $owner: String!
    $name: String!
    $closedPrPageSize: Int!
    $secondaryCommitsPerPr: Int!
    $after: String
  ) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        states: CLOSED
        first: $closedPrPageSize
        after: $after
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ...ClosedPrFields
        }
      }
    }
  }
`

// Unit 2: paginated default-branch commit history, mirroring the merged-
// PR/closed-PR pagination shape (`totalCount`/`pageInfo`/`nodes`) so it can
// run through the same `paginate()` helper and the same concurrent
// `Promise.all` start as the other two loops. `additions`/`deletions` are
// cheap fields directly on `Commit` (no extra round-trip), used to give a
// direct-commit burst's hypha a real work-based length, exactly like a
// merged PR's own `additions + deletions`. `associatedPullRequests` is how
// `mapDirectCommits` tells a genuine direct push apart from a commit that
// belongs to (or is the merge commit of) a pull request -- both are
// excluded, since a PR's own commits already render via its own hypha.
export const DIRECT_COMMITS_PAGE_QUERY = /* GraphQL */ `
  query DirectCommitsPage(
    $owner: String!
    $name: String!
    $pageSize: Int!
    $after: String
  ) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: $pageSize, after: $after) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                oid
                messageHeadline
                authoredDate
                url
                additions
                deletions
                author {
                  name
                  user {
                    login
                    avatarUrl
                  }
                }
                associatedPullRequests(first: 1) {
                  totalCount
                }
              }
            }
          }
        }
      }
    }
  }
`
