"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
export default function Nav() {
  const [label,setLabel]=useState("กำลังโหลด...");
  useEffect(()=>{(async()=>{const sb=createClient();const {data:{user}}=await sb.auth.getUser();if(!user){setLabel("ผู้ใช้");return;}const {data:p}=await sb.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();setLabel(`${p?.full_name||user.email} · ${p?.role||"staff"}`)})()},[]);
  return <><header className="top"><div><div className="brand">🏫 SCHOOL MAINTENANCE</div><div style={{fontSize:12,color:"#cbd5e1"}}>ระบบบริหารจัดการงานซ่อมแซมโรงเรียน</div></div><div style={{fontSize:13}}>{label}</div></header><nav className="nav"><Link href="/">ภาพรวม</Link><Link href="/requests/new">แจ้งซ่อม</Link><Link href="/requests">รายการงาน</Link><Link href="/reports">รายงาน</Link><form action="/auth/signout" method="post"><button className="btn" type="submit">ออกจากระบบ</button></form></nav></>;
}
