import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase-server";
export default async function Home() {
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single();
 const {data:rows}=await supabase.from("repair_requests").select("id,request_no,status,created_at,title,location_text").order("created_at",{ascending:false}).limit(8);
 const {count:all}=await supabase.from("repair_requests").select("*",{count:"exact",head:true});
 const {count:done}=await supabase.from("repair_requests").select("*",{count:"exact",head:true}).eq("status","เสร็จสิ้น");
 const {count:progress}=await supabase.from("repair_requests").select("*",{count:"exact",head:true}).eq("status","กำลังดำเนินการ");
 const {count:waiting}=await supabase.from("repair_requests").select("*",{count:"exact",head:true}).in("status",["รอตรวจสอบ","รอดำเนินการ"]);
 return <main className="shell"><Nav/><section className="stack"><div><h1>ภาพรวมงานซ่อมแซม</h1><div className="muted">ติดตามรายการแจ้งซ่อมของโรงเรียน</div></div><div className="grid">{[{t:"รายการทั้งหมด",n:all??0},{t:"รอตรวจสอบ / รอดำเนินการ",n:waiting??0},{t:"กำลังดำเนินการ",n:progress??0},{t:"เสร็จสิ้น",n:done??0}].map(x=><div className="card" key={x.t}><div className="muted">{x.t}</div><div className="stat">{x.n}</div><div className="muted">รายการ</div></div>)}</div><div className="card"><div className="row" style={{justifyContent:"space-between"}}><h2>รายการแจ้งซ่อมล่าสุด</h2><Link className="btn" href="/requests">ดูทั้งหมด</Link></div><div className="tablewrap"><table><thead><tr><th>เลขที่</th><th>รายการ</th><th>สถานที่</th><th>สถานะ</th></tr></thead><tbody>{(rows||[]).map(r=><tr key={r.id}><td><Link href={`/requests/${r.id}`}>{r.request_no}</Link></td><td>{r.title}</td><td>{r.location_text}</td><td><span className="badge">{r.status}</span></td></tr>)}</tbody></table>{!rows?.length&&<p className="muted">ยังไม่มีรายการแจ้งซ่อม</p>}</div></div><div className="row"><Link className="btn primary" href="/requests/new">＋ แจ้งซ่อมรายการใหม่</Link>{profile?.role==="admin"&&<Link className="btn" href="/admin">จัดการข้อมูลอาคาร</Link>}</div></section><div className="footer">ระบบแจ้งซ่อมโรงเรียน · ข้อมูลจัดเก็บบน Supabase</div></main>;
}
