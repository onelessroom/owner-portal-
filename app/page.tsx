import { redirect } from 'next/navigation'

// トップページはログインへリダイレクト
export default function Home() {
  redirect('/login')
}
