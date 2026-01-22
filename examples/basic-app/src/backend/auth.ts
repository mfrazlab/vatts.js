import {CredentialsProvider, createAuthRoutes, User, AuthConfig} from '@vatts/auth';


export const authConfig: AuthConfig = {
    providers: [
        new CredentialsProvider({
            authorize(credentials: Record<string, string>): Promise<User | null> | User | null {
                if (credentials.username === 'jsmith' && credentials.password === 'password123') {
                    return {
                        id: '1',
                        name: 'John Smith',
                        email: 'john.smith@gmail.com'
                    }
                }
                return null;
            },
            credentials: {
                username: { label: "Username", type: "text", placeholder: "jsmith" },
                password: { label: "Password", type: "password" }
            }
        })
    ],

    session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60,
    },

    pages: {
        signIn: '/login',
        signOut: '/'
    },
    callbacks: {
        async session({session, provider}) {
            return session;
        }
    },
    // ⚠️ SECURITY WARNING: Change this secret in production!
    // Generate a strong secret with: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
    // Or use environment variable: process.env.VATTS_AUTH_SECRET
    secret: 'hweb-test-secret-key-change-in-production'
};

export const authRoutes = createAuthRoutes(authConfig);
