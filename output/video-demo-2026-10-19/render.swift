import Foundation
import AVFoundation
import AppKit
import CoreVideo
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let output = root.appendingPathComponent("media-demo-slideshow-10s.mp4")
if FileManager.default.fileExists(atPath:output.path) { try FileManager.default.removeItem(at:output) }
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey:1280, AVVideoHeightKey:720])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:1280,kCVPixelBufferHeightKey as String:720])
writer.shouldOptimizeForNetworkUse = true
writer.add(input)
guard writer.startWriting() else { fatalError("Writer failed: \(String(describing:writer.error))") }
writer.startSession(atSourceTime:.zero)
let titles = ["A quiet beginning", "Leaves & light", "Everyday rituals", "Room to breathe", "A moment of calm"]
let colors:[NSColor] = [.init(red:0.14,green:0.24,blue:0.20,alpha:1),.init(red:0.29,green:0.39,blue:0.24,alpha:1),.init(red:0.48,green:0.36,blue:0.25,alpha:1),.init(red:0.25,green:0.36,blue:0.38,alpha:1),.init(red:0.21,green:0.27,blue:0.22,alpha:1)]
func drawText(_ text:String,_ x:CGFloat,_ y:CGFloat,_ size:CGFloat,_ color:NSColor) {
 text.draw(at:NSPoint(x:x,y:y),withAttributes:[.font:NSFont.systemFont(ofSize:size,weight:.medium),.foregroundColor:color])
}
for frame in 0..<250 {
 while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval:0.002) }
 var optional:CVPixelBuffer?
 CVPixelBufferPoolCreatePixelBuffer(nil,adaptor.pixelBufferPool!,&optional)
 let pixel=optional!; CVPixelBufferLockBaseAddress(pixel,[])
 let context=CGContext(data:CVPixelBufferGetBaseAddress(pixel),width:1280,height:720,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(pixel),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
 let scene=frame/50
 NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current=NSGraphicsContext(cgContext:context,flipped:false)
 colors[scene].setFill(); NSBezierPath(rect:NSRect(x:0,y:0,width:1280,height:720)).fill()
 // Each two-second scene is an original illustrated still image.
 NSColor(red:0.87,green:0.88,blue:0.74,alpha:0.13).setFill()
 NSBezierPath(ovalIn:NSRect(x:780,y:140,width:340,height:340)).fill()
 for leaf in 0..<5 {
  let path=NSBezierPath(ovalIn:NSRect(x:810+leaf*35,y:225+leaf*29,width:170,height:65))
  let transform=AffineTransform(rotationByDegrees:CGFloat(leaf*12-30)); path.transform(using:transform)
  NSColor(red:0.78,green:0.83,blue:0.63,alpha:0.3).setFill();path.fill()
 }
 drawText("ECOLITEA / MEDIA DEMO",72,620,22,.init(white:0.85,alpha:1))
 drawText(titles[scene],72,325,62,.init(white:0.96,alpha:1))
 drawText("SIMULATION SAMPLE  /  10 SECOND SLIDESHOW",76,264,17,.init(white:0.8,alpha:1))
 drawText(String(format:"%02d / 05",scene+1),76,68,22,.init(white:0.85,alpha:1))
 NSGraphicsContext.restoreGraphicsState()
 CVPixelBufferUnlockBaseAddress(pixel,[])
 guard adaptor.append(pixel,withPresentationTime:CMTime(value:Int64(frame),timescale:25)) else { fatalError("Append failed: \(String(describing:writer.error))") }
}
writer.endSession(atSourceTime:CMTime(seconds:10,preferredTimescale:25));input.markAsFinished()
let semaphore=DispatchSemaphore(value:0);writer.finishWriting{semaphore.signal()};semaphore.wait()
guard writer.status == .completed else { fatalError("Encoding failed: \(String(describing:writer.error))") }
let asset=AVURLAsset(url:output)
print("OUTPUT \(output.path)")
print("DURATION \(CMTimeGetSeconds(asset.duration)) seconds")
print("SIZE \((try FileManager.default.attributesOfItem(atPath:output.path)[.size])!) bytes")
