// backend/github.ts
import Expose from "vatts/rpc";
import {VattsRequest} from "vatts";

export async function getRepoInfo(_req: VattsRequest, owner: string, repo: string) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
    }
    return response.json();
}

export async function getContributors(_req: VattsRequest, owner: string, repo: string) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors`);
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
    }
    return response.json();
}

export async function getRepoStats(_req: VattsRequest, owner: string, repo: string) {
    // Note: Some of these endpoints might require authentication or have rate limits
    // You might want to implement caching or use GitHub's GraphQL API for better performance

    const [commitsResponse, releasesResponse, prsResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`),
        fetch(`https://api.github.com/repos/${owner}/${repo}/releases`),
        fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=1`)
    ]);

    // Get commit count from the Link header (GitHub provides this)
    const commitCount = parseInt(commitsResponse.headers.get('Link')?.match(/page=(\d+)>; rel="last"/)?.[1] || '0');

    const releases = await releasesResponse.json();
    const prs = await prsResponse.json();

    // Mock data for demonstration - in production, you'd fetch real data
    return {
        commit_count: commitCount,
        release_count: releases.length,
        pr_count: parseInt(prsResponse.headers.get('Link')?.match(/page=(\d+)>; rel="last"/)?.[1] || '0'),
        monthly_commits: Math.floor(Math.random() * 50) + 30, // Mock
        weekly_active: Math.floor(Math.random() * 15) + 5 // Mock
    };
}

Expose(getContributors, getRepoInfo, getRepoStats)