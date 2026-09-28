/**
 * GraphQL documents for the GitHub adapter. Kept as plain strings (not a
 * codegen artifact) since the query surface is small and stable.
 */

export const MERGED_PR_FRAGMENT = /* GraphQL */ `
  fragment MergedPrFields on PullRequest {
    number
    title
    url
    createdAt
    mergedAt
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
    commits(first: $commitsPerPr) {
      totalCount
      nodes {
        commit {
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
        }
      }
    }
  }
`

export const REPO_OVERVIEW_QUERY = /* GraphQL */ `
  ${MERGED_PR_FRAGMENT}
  query RepoOverview(
    $owner: String!
    $name: String!
    $prPageSize: Int!
    $commitsPerPr: Int!
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
        }
      }
      tags: refs(refPrefix: "refs/tags/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: ASC }) {
        nodes {
          name
          target {
            ... on Commit {
              committedDate
              url
            }
            ... on Tag {
              tagger {
                date
              }
              target {
                ... on Commit {
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
          number
          title
          url
          createdAt
          author {
            login
            avatarUrl
          }
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
