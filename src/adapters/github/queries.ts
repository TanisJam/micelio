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

// Closed-unmerged PRs are deliberately NOT fetched here: bundling a third
// paginated, commit-bearing connection into the overview query (alongside
// mergedPRs and openPRs) pushed its cost/latency high enough to trigger
// intermittent upstream 502/504s on repositories with substantial PR
// history (observed while generating fixtures). Fetching them as their own
// query (see `CLOSED_PRS_PAGE_QUERY`, also used for the first page) keeps
// every individual request cheaper and independently retriable.
export const REPO_OVERVIEW_QUERY = /* GraphQL */ `
  ${PR_COMMITS_FRAGMENT}
  ${SECONDARY_PR_COMMITS_FRAGMENT}
  ${MERGED_PR_FRAGMENT}
  ${OPEN_PR_FRAGMENT}
  query RepoOverview(
    $owner: String!
    $name: String!
    $prPageSize: Int!
    $commitsPerPr: Int!
    $secondaryCommitsPerPr: Int!
    $directCommitsScanned: Int!
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
        target {
          ... on Commit {
            history(first: $directCommitsScanned) {
              nodes {
                oid
                messageHeadline
                authoredDate
                url
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
      mergedPRs: pullRequests(states: MERGED, first: $prPageSize, orderBy: { field: CREATED_AT, direction: DESC }) {
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
