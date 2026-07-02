// Genera el icono de LIENZO (1024x1024 PNG): squircle oscuro + chispa en gradiente.
// Uso: swift make-icon.swift salida.png
import AppKit

let size: CGFloat = 1024
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon-1024.png"

let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()

// Fondo squircle (margen estilo Big Sur)
let inset: CGFloat = 100
let bgRect = NSRect(x: inset, y: inset, width: size - inset * 2, height: size - inset * 2)
let bgPath = NSBezierPath(roundedRect: bgRect, xRadius: 185, yRadius: 185)
NSGradient(colors: [
  NSColor(calibratedRed: 0.06, green: 0.06, blue: 0.10, alpha: 1),
  NSColor(calibratedRed: 0.10, green: 0.07, blue: 0.18, alpha: 1),
])!.draw(in: bgPath, angle: -60)

// Puntos sutiles de "canvas" en el fondo
NSColor(calibratedWhite: 1, alpha: 0.05).setFill()
let step: CGFloat = 88
var y = inset + 60
while y < size - inset - 40 {
  var x = inset + 60
  while x < size - inset - 40 {
    NSBezierPath(ovalIn: NSRect(x: x, y: y, width: 7, height: 7)).fill()
    x += step
  }
  y += step
}

// Chispa de 4 puntas con lados cóncavos
func sparkle(center c: CGPoint, R: CGFloat) -> NSBezierPath {
  let p = NSBezierPath()
  let top = CGPoint(x: c.x, y: c.y + R)
  let right = CGPoint(x: c.x + R, y: c.y)
  let bottom = CGPoint(x: c.x, y: c.y - R)
  let left = CGPoint(x: c.x - R, y: c.y)
  let k: CGFloat = 0.18 // qué tanto se hunden los lados hacia el centro
  let cp = { (a: CGPoint, b: CGPoint) -> CGPoint in
    CGPoint(x: c.x + (a.x + b.x - 2 * c.x) * k / 2, y: c.y + (a.y + b.y - 2 * c.y) * k / 2)
  }
  p.move(to: top)
  p.curve(to: right, controlPoint1: cp(top, right), controlPoint2: cp(top, right))
  p.curve(to: bottom, controlPoint1: cp(right, bottom), controlPoint2: cp(right, bottom))
  p.curve(to: left, controlPoint1: cp(bottom, left), controlPoint2: cp(bottom, left))
  p.curve(to: top, controlPoint1: cp(left, top), controlPoint2: cp(left, top))
  p.close()
  return p
}

let center = CGPoint(x: size / 2, y: size / 2)
let star = sparkle(center: center, R: 300)
let gradient = NSGradient(colors: [
  NSColor(calibratedRed: 0.04, green: 0.52, blue: 1.00, alpha: 1), // azul
  NSColor(calibratedRed: 0.75, green: 0.35, blue: 0.95, alpha: 1), // púrpura
  NSColor(calibratedRed: 1.00, green: 0.22, blue: 0.37, alpha: 1), // rosa
])!

// Halo
NSGraphicsContext.current?.saveGraphicsState()
let shadow = NSShadow()
shadow.shadowColor = NSColor(calibratedRed: 0.6, green: 0.4, blue: 1.0, alpha: 0.85)
shadow.shadowBlurRadius = 90
shadow.set()
gradient.draw(in: star, angle: -45)
NSGraphicsContext.current?.restoreGraphicsState()
gradient.draw(in: star, angle: -45)

// Chispa satélite pequeña
let mini = sparkle(center: CGPoint(x: size / 2 + 235, y: size / 2 + 225), R: 80)
gradient.draw(in: mini, angle: -45)

image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else {
  fatalError("No se pudo generar el PNG")
}
try! png.write(to: URL(fileURLWithPath: out))
print("Icono escrito en \(out)")
