import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../utils/supabase"; // Make sure to create this client file!
import {
  Mail,
  Phone,
  Globe,
  Youtube,
  Instagram,
  MapPin,
  Send,
} from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function ContactPage() {
  const { theme, lightMode } = useTheme();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [status, setStatus] = useState("idle");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("submitting");

    try {
      // 🟢 SUPABASE INSERT: Pushing data to a PostgreSQL table
      const { error } = await supabase.from("contact_messages").insert([
        {
          name: formData.name,
          email: formData.email,
          message: formData.message,
          status: "unread",
          // Note: Supabase Postgres usually handles the 'created_at' timestamp automatically
        },
      ]);

      if (error) throw error;

      setStatus("success");
      setFormData({ name: "", email: "", message: "" });
    } catch (error) {
      console.error("Supabase Error:", error.message);
      setStatus("error");
    }
  };

  const contactMethods = [
    {
      icon: Phone,
      title: "Phone",
      value: "+91 98920 160376",
      link: "tel:+9198920160376",
    },
    {
      icon: Mail,
      title: "Email",
      value: "ramchat007@gmail.com",
      link: "mailto:ramchat007@gmail.com",
    },
    {
      icon: Globe,
      title: "Website",
      value: "www.cricsynclive.in",
      link: "https://www.cricsynclive.in",
    },
    {
      icon: MapPin,
      title: "Location",
      value: "Mumbai, Maharashtra",
      link: null,
    },
  ];

  const socialLinks = [
    {
      icon: Youtube,
      name: "YouTube",
      link: "https://www.youtube.com/@CricSyncLive",
      color: "hover:text-red-500 hover:bg-red-500/10",
    },
    {
      icon: Instagram,
      name: "Instagram",
      link: "https://www.instagram.com/cricsynclive",
      color: "hover:text-pink-500 hover:bg-pink-500/10",
    },
  ];

  return (
    <>
      <Helmet>
        <title>Contact Us | CricSync</title>
        <meta
          name="description"
          content="Get in touch with the CricSync team for tournament support, onboarding, and business inquiries."
        />
      </Helmet>

      <div
        className={`max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in ${theme.text}`}
      >
        {/* Header */}
        <div className="text-center mb-12 mt-8">
          <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-500">
            Get in Touch
          </h1>
          <p
            className={`text-lg max-w-2xl mx-auto font-medium ${lightMode ? "text-gray-600" : "text-slate-400"}`}
          >
            Have a question about onboarding your tournament? <br />
            Need technical support? We are here to help.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* --- LEFT: CONTACT DETAILS --- */}
          <div className="lg:col-span-5 space-y-8">
            <div
              className={`p-8 rounded-[2.5rem] border ${lightMode ? "bg-white border-gray-200 shadow-xl" : "bg-[#1C2128] border-white/5 shadow-2xl"}`}
            >
              <h3 className="text-2xl font-black uppercase tracking-widest mb-6 leading-tight">
                Contact <br />
                <span className="text-teal-500">Information</span>
              </h3>

              <div className="space-y-6">
                {contactMethods.map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${lightMode ? "bg-teal-50 text-teal-600" : "bg-teal-500/10 text-teal-400"}`}
                    >
                      <item.icon size={20} />
                    </div>
                    <div>
                      <p
                        className={`text-[10px] font-bold uppercase tracking-widest ${theme.sub}`}
                      >
                        {item.title}
                      </p>
                      {item.link ? (
                        <a
                          href={item.link}
                          className={`font-bold hover:text-teal-500 transition-colors ${theme.text}`}
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className={`font-bold ${theme.text}`}>
                          {item.value}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Social Links */}
              <div
                className={`mt-8 pt-6 border-t ${lightMode ? "border-gray-200" : "border-white/10"}`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${theme.sub}`}
                >
                  Follow Us
                </p>
                <div className="flex gap-4">
                  {socialLinks.map((social, i) => (
                    <a
                      key={i}
                      href={social.link}
                      target="_blank"
                      rel="noreferrer"
                      className={`p-3 rounded-xl border transition-all duration-300 flex items-center gap-2 ${lightMode ? "bg-gray-50 border-gray-200 text-gray-600" : "bg-black/20 border-white/10 text-slate-400"} ${social.color}`}
                    >
                      <social.icon size={18} />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {social.name}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* --- RIGHT: SUPABASE FORM --- */}
          <div className="lg:col-span-7">
            <div
              className={`p-8 md:p-10 rounded-[2.5rem] border relative overflow-hidden h-full ${lightMode ? "bg-gradient-to-br from-teal-50/50 to-white border-teal-100 shadow-xl" : "bg-gradient-to-br from-teal-900/10 to-[#161920] border-white/10 shadow-2xl"}`}
            >
              <h3 className="text-2xl font-black uppercase tracking-widest mb-2">
                Send a Message
              </h3>
              <p
                className={`text-sm font-medium mb-8 ${lightMode ? "text-gray-500" : "text-slate-400"}`}
              >
                Fill out the form below and our team will get back to you within
                24 hours.
              </p>

              {status === "success" ? (
                <div
                  className={`p-8 border rounded-3xl text-center flex flex-col items-center justify-center h-64 ${lightMode ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-teal-500/10 border-teal-500/30 text-teal-400"}`}
                >
                  <div className="w-16 h-16 bg-teal-500 text-white rounded-full flex items-center justify-center mb-4 shadow-lg shadow-teal-500/30">
                    <Send size={24} className="ml-1" />
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-widest mb-2">
                    Message Sent!
                  </h4>
                  <p className="text-sm font-medium opacity-80">
                    We've received your inquiry and will be in touch shortly.
                  </p>
                  <button
                    onClick={() => setStatus("idle")}
                    className="mt-6 text-xs font-bold uppercase tracking-widest underline underline-offset-4"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="space-y-5 relative z-10"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label
                        className={`text-[10px] font-bold uppercase tracking-widest mb-2 block ${theme.sub}`}
                      >
                        Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        required
                        className={`w-full p-4 rounded-2xl border outline-none font-medium transition-colors ${lightMode ? "bg-white border-gray-200 text-gray-900 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10" : "bg-black/20 border-white/10 text-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20"}`}
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label
                        className={`text-[10px] font-bold uppercase tracking-widest mb-2 block ${theme.sub}`}
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="john@example.in"
                        required
                        className={`w-full p-4 rounded-2xl border outline-none font-medium transition-colors ${lightMode ? "bg-white border-gray-200 text-gray-900 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10" : "bg-black/20 border-white/10 text-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20"}`}
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className={`text-[10px] font-bold uppercase tracking-widest mb-2 block ${theme.sub}`}
                    >
                      Your Message
                    </label>
                    <textarea
                      placeholder="Tell us about your tournament..."
                      required
                      rows="6"
                      className={`w-full p-4 rounded-2xl border outline-none font-medium resize-none transition-colors ${lightMode ? "bg-white border-gray-200 text-gray-900 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10" : "bg-black/20 border-white/10 text-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20"}`}
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                    />
                  </div>

                  {status === "error" && (
                    <p className="text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                      Failed to send message. Please try again later.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="w-full py-4 bg-teal-600 text-white font-black rounded-2xl uppercase tracking-widest hover:bg-teal-500 transition-all active:scale-[0.98] flex justify-center items-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-70 disabled:active:scale-100"
                  >
                    {status === "submitting" ? (
                      <span className="animate-pulse">Sending...</span>
                    ) : (
                      <>
                        Send Message <Send size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
