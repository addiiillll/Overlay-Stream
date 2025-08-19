"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import LiveDemo from "@/components/live-demo"
import {
  Layers,
  Zap,
  Shield,
  Users,
  Star,
  ArrowRight,
  CheckCircle,
  Video,
  Settings,
  Globe,
  Sparkles,
  TrendingUp,
  Award,
} from "lucide-react"


export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToDemo = () => {
    const demoSection = document.getElementById('demo-section')
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const features = [
    {
      icon: <Video className="h-8 w-8" />,
      title: "RTSP Stream Support",
      description: "Connect any RTSP source - IP cameras, streaming servers, or live feeds with seamless integration.",
    },
    {
      icon: <Layers className="h-8 w-8" />,
      title: "Dynamic Overlays",
      description: "Add custom text, logos, and graphics with real-time positioning and resizing capabilities.",
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: "Real-time Processing",
      description: "Ultra-low latency overlay rendering with hardware-accelerated video processing.",
    },
    {
      icon: <Settings className="h-8 w-8" />,
      title: "Advanced Controls",
      description: "Comprehensive CRUD API for overlay management with granular control over every element.",
    },
    {
      icon: <Globe className="h-8 w-8" />,
      title: "Cloud-Native",
      description: "Scalable infrastructure that grows with your streaming needs, from startup to enterprise.",
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Enterprise Security",
      description: "Bank-grade security with encrypted streams and secure API endpoints for your content.",
    },
  ]

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Live Stream Producer",
      company: "TechCorp Media",
      content: "StreamOverlay Pro transformed our production workflow. The real-time overlay management is incredible.",
      rating: 5,
    },
    {
      name: "Marcus Rodriguez",
      role: "CTO",
      company: "StreamTech Solutions",
      content: "The API integration was seamless. Our developers had it running in production within hours.",
      rating: 5,
    },
    {
      name: "Emily Watson",
      role: "Content Director",
      company: "Digital Broadcast Co.",
      content: "Finally, a professional overlay solution that doesn't break the bank. The quality is outstanding.",
      rating: 5,
    },
  ]

  const stats = [
    { value: "99.9%", label: "Uptime SLA" },
    { value: "< 50ms", label: "Latency" },
    { value: "10M+", label: "Streams Processed" },
    { value: "150+", label: "Countries Served" },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center animate-glow">
                <Layers className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-xl">OverlayStream</span>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Button
                size="sm"
                onClick={scrollToDemo}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32 min-h-screen flex items-center">
        <div className="absolute inset-0 gradient-teal-subtle" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center">
            <Badge variant="secondary" className="mb-6 animate-float bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-4 w-4 mr-1" />
              Now with AI-powered overlay suggestions
            </Badge>
            <h1 className="font-heading font-black text-4xl md:text-6xl lg:text-7xl mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Overlay while your 
              <br />
              Video Streams
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
              Transform your livestreams with dynamic overlays. Add custom text, logos, and graphics to any RTSP stream
              with our powerful, cloud-native platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button
                size="lg"
                onClick={scrollToDemo}
                className="px-8 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Video className="mr-2 h-5 w-5" />
                View Live Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-4 text-lg font-semibold bg-card/50 hover:bg-card/80 border-border/50 hover:border-border transition-all duration-300 shadow-sm hover:shadow-md"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="font-heading font-black text-3xl md:text-4xl text-primary mb-2">{stat.value}</div>
                <div className="text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-primary/20 text-primary">
              <Award className="h-4 w-4 mr-1" />
              Industry Leading Features
            </Badge>
            <h2 className="font-heading font-bold text-3xl md:text-5xl mb-6">
              Everything you need for
              <br />
              <span className="text-primary">professional streaming</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built for creators, broadcasters, and enterprises who demand the highest quality overlay management.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border-0 shadow-lg bg-card/50 backdrop-blur-sm hover:bg-card/80"
              >
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform group-hover:bg-primary/20">
                    {feature.icon}
                  </div>
                  <CardTitle className="font-heading font-bold text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo-section" className="py-20 lg:py-32 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LiveDemo />
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-primary/20 text-primary">
              <Users className="h-4 w-4 mr-1" />
              Trusted by Professionals
            </Badge>
            <h2 className="font-heading font-bold text-3xl md:text-5xl mb-6">What our customers say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <CardDescription className="text-base leading-relaxed">"{testimonial.content}"</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 gradient-teal text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading font-black text-3xl md:text-5xl mb-6">Ready to transform your streams?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of creators and broadcasters who trust StreamOverlay Pro for their professional streaming
            needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              variant="secondary"
              className="min-w-[200px] bg-white/20 hover:bg-white/30 text-white border-white/20"
              suppressHydrationWarning
            >
              <TrendingUp className="mr-2 h-5 w-5" />
              Start Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-w-[200px] bg-white/10 border-white/20 text-white hover:bg-white/20"
              suppressHydrationWarning
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card/50 backdrop-blur-sm py-12 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Layers className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-xl">StreamOverlay Pro</span>
            </div>
            <div className="flex space-x-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Support
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                API Docs
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © 2024 StreamOverlay Pro. All rights reserved. Built with precision for professional streaming.
          </div>
        </div>
      </footer>
    </div>
  )
}
