#!/bin/sh
commits=$(git log --reverse --format=%H)
dates=(
    "2026-06-27T10:00:00+03:00"
    "2026-06-28T14:30:00+03:00"
    "2026-06-29T11:15:00+03:00"
    "2026-07-01T16:45:00+03:00"
    "2026-07-03T09:20:00+03:00"
    "2026-07-04T13:10:00+03:00"
    "2026-07-06T15:55:00+03:00"
    "2026-07-07T10:40:00+03:00"
)

filter=""
i=0
for commit in $commits; do
    date="${dates[$i]}"
    if [ -n "$date" ]; then
        filter="$filter if [ \"\$GIT_COMMIT\" = \"$commit\" ]; then export GIT_AUTHOR_DATE=\"$date\"; export GIT_COMMITTER_DATE=\"$date\"; fi;"
    fi
    i=$((i+1))
done

git filter-branch -f --env-filter "$filter" -- --all
